const axios = require('axios');
const fs = require('fs');

// Mock environment variables BEFORE requiring the service
process.env.PINATA_API_KEY = 'test_key';
process.env.PINATA_API_SECRET = 'test_secret';

const pinataService = require('../src/services/pinataService');

jest.mock('axios');

describe('Pinata Service', () => {
    test('pinFileToIPFS should call axios.post with correct args', async () => {
        const mockResponse = {
            data: {
                IpfsHash: 'QmTestHash',
                PinSize: 123,
                Timestamp: '2023-01-01T00:00:00Z'
            }
        };
        axios.post.mockResolvedValue(mockResponse);

        // Mock stream
        const stream = fs.createReadStream(__filename); // Use current file as dummy stream

        const result = await pinataService.pinFileToIPFS(stream, 'test.txt');

        expect(result.success).toBe(true);
        expect(result.cid).toBe('QmTestHash');
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('/pinning/pinFileToIPFS'),
            expect.any(Object), // FormData
            expect.objectContaining({
                headers: expect.any(Object)
            })
        );
    });

    test('listPins should call axios.get', async () => {
        const mockResponse = {
            data: {
                count: 1,
                rows: [{ ipfs_pin_hash: 'QmTest' }]
            }
        };
        axios.get.mockResolvedValue(mockResponse);

        const result = await pinataService.listPins({ status: 'pinned' });

        expect(result.count).toBe(1);
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining('/data/pinList'),
            expect.any(Object)
        );
    });
});
