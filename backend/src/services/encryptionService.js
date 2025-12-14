const crypto = require('crypto');
const secrets = require('secrets.js-grempe');

// AES-GCM Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const KEY_LENGTH = 32; // 256 bits

/**
 * Generates a random 256-bit AES key encoded in Base64
 * @returns {string} Base64 encoded key
 */
const generateSymKey = () => {
    return crypto.randomBytes(KEY_LENGTH).toString('base64');
};

/**
 * Encrypts a buffer using AES-256-GCM
 * @param {Buffer} buffer - Data to encrypt
 * @param {string} base64Key - Base64 encoded key
 * @returns {Object} { ciphertextBase64, ivBase64, tagBase64 }
 */
const encryptBuffer = (buffer, base64Key) => {
    const key = Buffer.from(base64Key, 'base64');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
        ciphertextBase64: encrypted.toString('base64'),
        ivBase64: iv.toString('base64'),
        tagBase64: tag.toString('base64')
    };
};

/**
 * Decrypts a buffer using AES-256-GCM
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @param {string} tagBase64 
 * @param {string} base64Key 
 * @returns {Buffer} Decrypted data
 */
const decryptBuffer = (ciphertextBase64, ivBase64, tagBase64, base64Key) => {
    const key = Buffer.from(base64Key, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    const encrypted = Buffer.from(ciphertextBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
};

/**
 * Splits a key into n shards with threshold t using Shamir's Secret Sharing
 * @param {string} base64Key - The secret key to split
 * @param {number} n - Total number of shards
 * @param {number} t - Threshold number of shards to reconstruct
 * @returns {Array<string>} Array of hex-encoded shards
 */
const splitKeyToShards = (base64Key, n, t) => {
    // secrets.js works with hex strings
    const keyHex = Buffer.from(base64Key, 'base64').toString('hex');
    const shards = secrets.share(keyHex, n, t);
    return shards;
};

/**
 * Combines shards to reconstruct the key
 * @param {Array<string>} shardsArray - Array of hex-encoded shards
 * @returns {string} Reconstructed Base64 key
 */
const combineShards = (shardsArray) => {
    const keyHex = secrets.combine(shardsArray);
    return Buffer.from(keyHex, 'hex').toString('base64');
};

/**
 * Example Usage:
 * 
 * const key = generateSymKey();
 * const data = Buffer.from('Secret File Content');
 * const { ciphertextBase64, ivBase64, tagBase64 } = encryptBuffer(data, key);
 * 
 * const shards = splitKeyToShards(key, 5, 3);
 * // Store shards...
 * 
 * // Retrieve 3 shards
 * const recoveredKey = combineShards(shards.slice(0, 3));
 * const decrypted = decryptBuffer(ciphertextBase64, ivBase64, tagBase64, recoveredKey);
 * console.log(decrypted.toString() === 'Secret File Content'); // true
 */

module.exports = {
    generateSymKey,
    encryptBuffer,
    decryptBuffer,
    splitKeyToShards,
    combineShards
};
