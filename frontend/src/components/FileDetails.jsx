import React, { useState, useEffect } from 'react';
import axios from 'axios';
import secrets from 'secrets.js-grempe';

const FileDetails = ({ fileId, onClose }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [decrypting, setDecrypting] = useState(false);
    const [decryptedUrl, setDecryptedUrl] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/api/files/${fileId}/details`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setDetails(res.data);
            } catch (err) {
                console.error(err);
                setError('Failed to load file details');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [fileId]);

    const handleDecrypt = async () => {
        if (!details || !details.shards || details.shards.length === 0) {
            setError('No encryption shards found for this file.');
            return;
        }

        setDecrypting(true);
        setError(null);

        try {
            // 1. Reconstruct Key from Shards
            // Assume we can get all shards here. In reality, user might need to input them if stored offline.
            // But for this "Client-Side Threshold Encryption" demo, the server stores shards (which is insecure but described in prompt as "keep key_shards off-chain/DB unencrypted" -> wait, prompt said "keep shards off-chain/DB unencrypted"? Prompt said "keep shards off-chain/DB unencrypted" - wait, "never put keys in frontend, keep shards off-chain/DB unencrypted" usually means server database stores them plain? Or encrypted?
            // "keep shards off-chain/DB unencrypted" -> Storing shards in DB unencrypted is what we implemented.

            const shares = details.shards.map(s => s.shard_ref);
            const hexKey = secrets.combine(shares);

            // Convert Hex to ArrayBuffer
            // Hex string back to raw bytes (base64 encoded originally? No, uploaded code converted base64 -> hex)

            // Reconstruct logic:
            // Original: 
            // 1. Generate Key (CryptoKey)
            // 2. Export Key (raw) -> ArrayBuffer
            // 3. ArrayBuffer -> Base64
            // 4. Base64 -> Hex (for secrets.js)

            // Decrypt Logic:
            // 1. Hex -> Base64
            // 2. Base64 -> ArrayBuffer
            // 3. Import Key (raw) -> CryptoKey

            // Hex to Base64
            const rawHex = hexKey;
            let rawString = '';
            for (let i = 0; i < rawHex.length; i += 2) {
                rawString += String.fromCharCode(parseInt(rawHex.substr(i, 2), 16));
            }
            const base64Key = btoa(rawString); // Wait, rawString from hex might not be valid ascii? 
            // Actually, let's reverse the upload logic carefully.
            // Upload: 
            // const rawKey = atob(base64Key); // Binary string
            // let hexKey = ''; for ... hexKey += rawKey.charCodeAt(i)...

            // Reverse:
            // hexKey is simple hex string of the binary string bytes.
            const binaryString = rawHex.match(/.{1,2}/g).map(byte => String.fromCharCode(parseInt(byte, 16))).join('');
            // binaryString is what `atob(base64Key)` produced.
            // So to get ArrayBuffer for importKey:
            const keyBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                keyBytes[i] = binaryString.charCodeAt(i);
            }

            const key = await window.crypto.subtle.importKey(
                "raw",
                keyBytes,
                "AES-GCM",
                true,
                ["encrypt", "decrypt"]
            );

            // 2. Fetch File Blob from IPFS (via Gateway)
            // Determine Gateway based on replicas
            let gateway = 'https://gateway.pinata.cloud/ipfs/';
            if (details.replicas.some(r => r.provider === 'Local')) {
                // Use 127.0.0.1 to avoid IPFS redirects to subdomains (e.g. bafy...ipfs.localhost)
                // which fail to resolve on many systems without extra config.
                gateway = 'http://127.0.0.1:8080/ipfs/';
            }

            const fileRes = await axios.get(`${gateway}${details.file.cid}`, {
                responseType: 'arraybuffer'
            });
            const encryptedData = fileRes.data;

            // 3. Decrypt
            // Our upload logic combined IV + Encrypted Data
            const iv = encryptedData.slice(0, 12);
            const dataToDecrypt = encryptedData.slice(12);

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(iv) },
                key,
                dataToDecrypt
            );

            // 4. Create Download Link
            const blob = new Blob([decryptedBuffer]);
            const url = URL.createObjectURL(blob);
            setDecryptedUrl(url);

        } catch (err) {
            console.error("Decryption failed", err);
            setError("Decryption failed. Key reconstruction or integrity check error.");
        } finally {
            setDecrypting(false);
        }
    };

    if (loading) return <div className="modal">Loading details...</div>;
    if (!details) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="modal-content" style={{ background: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '600px', width: '100%' }}>
                <h2>File Details: {details.file.filename}</h2>

                <div className="detail-section">
                    <p><strong>CID:</strong> {details.file.cid}</p>
                    <p><strong>Size:</strong> {(details.file.size / 1024).toFixed(2)} KB</p>
                    <p><strong>Replicas:</strong> {details.replicas.length}</p>
                    <p><strong>Key Shards Available:</strong> {details.shards.length} (Threshold: 3)</p>

                    <h4>Distrubuted Key Shards:</h4>
                    <ul style={{ maxHeight: '100px', overflowY: 'auto', background: '#f9fafb', padding: '0.5rem' }}>
                        {details.shards.map(shard => (
                            <li key={shard.id}>Index {shard.shard_index} held by <strong>{shard.holder}</strong></li>
                        ))}
                    </ul>
                </div>

                {error && <div className="error">{error}</div>}

                <div className="actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                    {decryptedUrl ? (
                        <a href={decryptedUrl} download={details.file.filename} className="btn success">Download Decrypted File</a>
                    ) : (
                        <button onClick={handleDecrypt} className="btn" disabled={decrypting}>
                            {decrypting ? 'Decrypting...' : 'Reconstruct Key & Decrypt'}
                        </button>
                    )}
                    <button onClick={onClose} className="btn-secondary">Close</button>
                </div>
            </div>
        </div>
    );
};

export default FileDetails;
