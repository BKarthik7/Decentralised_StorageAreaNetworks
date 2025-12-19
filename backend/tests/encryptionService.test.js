const encryptionService = require('../src/services/encryptionService');

describe('Encryption Service', () => {
    test('encryptBuffer and decryptBuffer should roundtrip', () => {
        const key = encryptionService.generateSymKey();
        const data = Buffer.from('Hello World Secret');

        const { ciphertextBase64, ivBase64, tagBase64 } = encryptionService.encryptBuffer(data, key);

        const decrypted = encryptionService.decryptBuffer(ciphertextBase64, ivBase64, tagBase64, key);

        expect(decrypted.toString()).toBe('Hello World Secret');
    });

    test('splitKeyToShards and combineShards should restore key', () => {
        const key = encryptionService.generateSymKey();
        const n = 5;
        const t = 3;

        const shards = encryptionService.splitKeyToShards(key, n, t);
        expect(shards.length).toBe(n);

        // Combine t shards
        const recoveredKey = encryptionService.combineShards(shards.slice(0, t));
        expect(recoveredKey).toBe(key);

        // Combine > t shards
        const recoveredKey2 = encryptionService.combineShards(shards);
        expect(recoveredKey2).toBe(key);
    });

    test('combineShards should fail if less than t shards provided', () => {
        const key = encryptionService.generateSymKey();
        const n = 5;
        const t = 3;

        const shards = encryptionService.splitKeyToShards(key, n, t);

        // Try with only 2 shards (t=3)
        // secrets.js-grempe does not throw, but returns an incorrect secret
        const wrongKey = encryptionService.combineShards(shards.slice(0, 2));
        expect(wrongKey).not.toBe(key);
    });
});
