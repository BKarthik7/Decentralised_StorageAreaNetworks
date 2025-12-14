const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { ethers } = require('ethers');
const db = require('../services/db/client');
const pinataService = require('../services/pinataService');
const jwtAuth = require('../middleware/jwtAuth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Minimal ABI for storeMetadata
const CONTRACT_ABI = [
    "function storeMetadata(string _cid, string _filename, uint256 _size)"
];

const getContract = async () => { // Made async due to potential await call
    if (!process.env.CONTRACT_ADDRESS || !process.env.ETH_PROVIDER_URL) { // Removed CONTRACT_PRIVATE_KEY from this check
        console.warn('Blockchain config missing (CONTRACT_ADDRESS or ETH_PROVIDER_URL), skipping contract call');
        return null;
    }
    const provider = new ethers.JsonRpcProvider(process.env.ETH_PROVIDER_URL);

    let contract;
    if (process.env.CONTRACT_PRIVATE_KEY) {
        const wallet = new ethers.Wallet(process.env.CONTRACT_PRIVATE_KEY, provider);
        contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    } else {
        // Use unlocked account (Ganache) if private key is not provided
        try {
            const signer = await provider.getSigner(0); // Get the first signer
            contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            console.warn('Using default signer (account 0) as CONTRACT_PRIVATE_KEY is not set.');
        } catch (e) {
            console.error('Failed to get signer from provider. Ensure an unlocked account is available or CONTRACT_PRIVATE_KEY is set.', e);
            return null;
        }
    }
    return contract;
};

router.post('/upload', jwtAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { encrypted, shards } = req.body; // shards is a JSON string if provided
        const isEncrypted = encrypted === 'true';
        const filePath = req.file.path;
        const filename = req.file.originalname;
        const size = req.file.size;
        const uploaderId = req.user.userId;

        // 1. Pin to IPFS via Pinata
        const fileStream = fs.createReadStream(filePath);
        const pinResult = await pinataService.pinFileToIPFS(fileStream, filename);

        // Clean up temp file
        fs.unlinkSync(filePath);

        if (!pinResult.success) {
            throw new Error('Failed to pin file to IPFS');
        }

        const cid = pinResult.cid;
        const metadataHash = ''; // Placeholder for now, could be hash of metadata

        // 2. Insert into DB
        const fileRows = await db.query(
            'INSERT INTO files (uploader_id, cid, filename, size, metadata_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [uploaderId, cid, filename, size, metadataHash]
        );
        const fileId = fileRows[0].id;

        // 3. Insert initial replica
        await db.query(
            'INSERT INTO replicas (file_id, provider, status) VALUES ($1, $2, $3)',
            [fileId, pinResult.provider || 'Pinata', 'pinned']
        );

        // 4. Handle Key Shards if encrypted
        if (isEncrypted && shards) {
            const shardsArray = JSON.parse(shards);
            for (const shard of shardsArray) {
                await db.query(
                    'INSERT INTO key_shards (file_id, shard_index, shard_ref, holder) VALUES ($1, $2, $3, $4)',
                    [fileId, shard.index, shard.ref, shard.holder]
                );
            }
        }

        // 5. Call Smart Contract
        let txHash = null;
        const contract = await getContract();
        if (contract) {
            try {
                const tx = await contract.storeMetadata(cid, filename, size);
                await tx.wait();
                txHash = tx.hash;
                console.log(`Blockchain transaction successful: ${txHash}`);
            } catch (chainErr) {
                console.error('Blockchain transaction failed:', chainErr);
                // We don't fail the request, just log it. 
                // In production, might want a queue to retry.
            }
        }

        res.json({
            success: true,
            fileId,
            cid,
            txHash
        });

    } catch (err) {
        console.error('Upload error:', err);
        // Clean up temp file if it exists and wasn't deleted
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;
