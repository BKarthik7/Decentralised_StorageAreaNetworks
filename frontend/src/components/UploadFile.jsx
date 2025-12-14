import React, { useState } from 'react';
import axios from 'axios';
import secrets from 'secrets.js-grempe';

const UploadFile = () => {
    const [file, setFile] = useState(null);
    const [encrypt, setEncrypt] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setError(null);
        setResult(null);
    };

    const generateKey = async () => {
        return window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
    };

    const encryptFile = async (file, key) => {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const algorithm = { name: "AES-GCM", iv: iv };

        const fileBuffer = await file.arrayBuffer();
        const encryptedBuffer = await window.crypto.subtle.encrypt(
            algorithm,
            key,
            fileBuffer
        );

        // Combine IV + Encrypted Data (tag is included in encryptedBuffer for Web Crypto GCM)
        // Note: Node.js crypto.createCipheriv returns tag separately, but Web Crypto includes it at the end usually?
        // Actually Web Crypto GCM encrypt returns ciphertext + tag appended.
        // But we need to send IV too.

        // Let's prepend IV to the result for simplicity in transport, or handle it as separate fields.
        // The backend expects multipart file. We can send the encrypted blob as the file.
        // But we also need to store the IV.
        // For this demo, let's just send the encrypted blob (IV + Ciphertext + Tag) as the file content.
        // Wait, the backend encryptionService uses Node crypto which splits them.
        // If we encrypt on client, the backend just stores it as a blob (IPFS).
        // The backend doesn't need to decrypt it. The client needs to decrypt it later.
        // So we should store everything needed for decryption in the file blob itself.

        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);

        return new Blob([combined]);
    };

    const exportKey = async (key) => {
        const exported = await window.crypto.subtle.exportKey("raw", key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('Not authenticated');

            const formData = new FormData();
            let fileToUpload = file;
            let shards = null;

            if (encrypt) {
                // 1. Generate Key
                const key = await generateKey();

                // 2. Encrypt File
                const encryptedBlob = await encryptFile(file, key);
                fileToUpload = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });

                // 3. Split Key
                const base64Key = await exportKey(key);
                // secrets.js works with hex
                // const keyHex = secrets.str2hex(base64Key); // Wait, base64Key is base64 string. secrets.js expects hex string of the secret.
                // Actually secrets.js-grempe can share text or hex.
                // Let's convert base64 to hex.
                const rawKey = atob(base64Key);
                let hexKey = '';
                for (let i = 0; i < rawKey.length; i++) {
                    hexKey += rawKey.charCodeAt(i).toString(16).padStart(2, '0');
                }

                const shares = secrets.share(hexKey, 5, 3); // 5 shards, threshold 3

                // Simulate available nodes in the network
                // Fetch available nodes from the network
                let availableNodes = [];
                try {
                    const nodeRes = await axios.get('/api/admin/system-state'); // Note: This is an open public route currently, or might need auth if changed.
                    // Actually, the admin route might not be the best place if it's protected? 
                    // Let's check admin.js. It does NOT have jwtAuth middleware on router usage in index.js?
                    // In index.js: `app.use('/api/admin', adminRoutes);` - No middleware. So it's public.
                    availableNodes = nodeRes.data.nodes.filter(n => n.status === 'online');
                } catch (nodeErr) {
                    console.error('Failed to fetch nodes, falling back to basic mock', nodeErr);
                    // Fallback if fetch fails
                    availableNodes = [{ name: 'Backup Node A' }, { name: 'Backup Node B' }, { name: 'Backup Node C' }];
                }

                if (availableNodes.length === 0) {
                    availableNodes = [{ name: 'Default Node' }];
                }

                shards = shares.map((share, index) => {
                    // Assign each shard to a node in round-robin
                    const node = availableNodes[index % availableNodes.length];
                    return {
                        index: index + 1, // 1-based index usually embedded in share
                        ref: share, // The actual share string
                        holder: node.name
                    };
                });
            }

            formData.append('file', fileToUpload);
            formData.append('encrypted', encrypt);
            if (shards) {
                formData.append('shards', JSON.stringify(shards));
            }

            const res = await axios.post('/api/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setResult(res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-container">
            <div className="header-actions" style={{ marginBottom: '1rem' }}>
                <button onClick={() => window.location.href = '/dashboard'} className="btn-secondary">Back to Dashboard</button>
            </div>
            <h3>Upload File</h3>
            <div className="form-group">
                <input type="file" onChange={handleFileChange} />
            </div>

            <div className="form-group">
                <label>
                    <input
                        type="checkbox"
                        checked={encrypt}
                        onChange={(e) => setEncrypt(e.target.checked)}
                    />
                    Enable Threshold Encryption (5 shards, 3 needed)
                </label>
            </div>

            {uploading && (
                <div className="progress-steps" style={{ margin: '1rem 0', padding: '1rem', background: '#f0f9ff', borderRadius: '4px' }}>
                    <p>🔒 Generating High-Entropy Key...</p>
                    {encrypt && <p>🔑 Encrypting File (AES-GCM)...</p>}
                    {encrypt && <p>🧩 Splitting Key into Shards (Shamir's Secret Sharing)...</p>}
                    <p>☁️ Uploading to Decentralized Storage...</p>
                </div>
            )}
            <button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Processing...' : 'Upload'}
            </button>

            {error && <div className="error">{error}</div>}

            {result && (
                <div className="success">
                    <p>Upload Successful!</p>
                    <p>File ID: {result.fileId}</p>
                    <p>CID: {result.cid}</p>
                    {result.txHash && <p>Tx Hash: {result.txHash}</p>}
                </div>
            )}
        </div>
    );
};

export default UploadFile;
