const axios = require('axios');
const FormData = require('form-data');

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PINATA_JWT = process.env.PINATA_JWT;

const BASE_URL = 'https://api.pinata.cloud';

const getHeaders = (multipart = false) => {
    const headers = {};
    if (PINATA_JWT) {
        headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_API_SECRET) {
        headers['pinata_api_key'] = PINATA_API_KEY;
        headers['pinata_secret_api_key'] = PINATA_API_SECRET;
    } else {
        console.warn('Pinata credentials missing!');
    }
    return headers;
};

const pinFileToIPFS = async (fileStream, filename) => {
    // Check if Pinata keys are present
    if (PINATA_JWT || (PINATA_API_KEY && PINATA_API_SECRET)) {
        try {
            const data = new FormData();
            data.append('file', fileStream, { filename });

            // Optional: Add metadata
            const metadata = JSON.stringify({
                name: filename,
                keyvalues: {
                    origin: 'san-storage'
                }
            });
            data.append('pinataMetadata', metadata);

            const headers = {
                ...getHeaders(),
                ...data.getHeaders()
            };

            const res = await axios.post(`${BASE_URL}/pinning/pinFileToIPFS`, data, {
                maxBodyLength: 'Infinity',
                headers
            });

            return {
                success: true,
                cid: res.data.IpfsHash,
                raw: res.data,
                provider: 'Pinata'
            };
        } catch (err) {
            console.error('Error pinning file to Pinata:', err.response?.data || err.message);
            // Fallback to local IPFS if Pinata fails? Or just throw?
            // For now, let's try local IPFS if Pinata fails or if keys are missing.
            console.log('Falling back to local IPFS...');
        }
    } else {
        console.log('No Pinata keys found. Using local IPFS...');
    }

    // Local IPFS Fallback
    try {
        const data = new FormData();
        data.append('file', fileStream, { filename });

        const res = await axios.post('http://localhost:5001/api/v0/add', data, {
            headers: data.getHeaders(),
            maxBodyLength: 'Infinity'
        });

        // Local IPFS returns { Name, Hash, Size }
        return {
            success: true,
            cid: res.data.Hash,
            raw: res.data,
            provider: 'Local'
        };
    } catch (localErr) {
        console.error('Error pinning to local IPFS:', localErr.message);
        throw new Error('Failed to pin file to IPFS (Pinata and Local failed)');
    }
};

const pinByHash = async (cid, name) => {
    try {
        const body = {
            hashToPin: cid,
            pinataMetadata: {
                name: name || cid,
                keyvalues: {
                    origin: 'san-storage-replica'
                }
            }
        };

        const res = await axios.post(`${BASE_URL}/pinning/pinByHash`, body, {
            headers: getHeaders()
        });

        return {
            success: true,
            cid: res.data.ipfsHash, // Note: pinByHash returns ipfsHash (lowercase) usually, check docs if unsure
            raw: res.data
        };
    } catch (err) {
        console.error('Error pinning by hash:', err.response?.data || err.message);
        throw new Error('Failed to pin by hash');
    }
};

const listPins = async (queryParams = {}) => {
    try {
        const queryString = new URLSearchParams(queryParams).toString();
        const res = await axios.get(`${BASE_URL}/data/pinList?${queryString}`, {
            headers: getHeaders()
        });

        return {
            success: true,
            count: res.data.count,
            rows: res.data.rows
        };
    } catch (err) {
        console.error('Error listing pins:', err.response?.data || err.message);
        throw new Error('Failed to list pins');
    }
};

module.exports = {
    pinFileToIPFS,
    pinByHash,
    listPins
};
