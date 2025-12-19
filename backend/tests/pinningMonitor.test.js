const pinningMonitor = require('../src/services/pinningMonitor');
const db = require('../src/services/db/client');
const pinataService = require('../src/services/pinataService');

// Mock dependencies
jest.mock('../src/services/db/client');
jest.mock('../src/services/pinataService');

describe('Pinning Monitor (Adaptive Replication)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should do nothing if no hot files found', async () => {
        // Mock DB returning 0 hot files
        db.query.mockResolvedValueOnce([]);

        await pinningMonitor.evaluateAndReplicate();

        expect(db.query).toHaveBeenCalledTimes(1); // Only checked for hot files
        expect(pinataService.pinByHash).not.toHaveBeenCalled();
    });

    test('should replicate file if it is hot and under-replicated', async () => {
        // 1. Mock "Hot Files" query
        db.query.mockResolvedValueOnce([{ file_id: 100, access_count: 10 }]);

        // 2. Mock "Check Replicas" query (Returns only 1, Target is 3)
        db.query.mockResolvedValueOnce([{ id: 1, provider: 'Original' }]);

        // 3. Mock "Get File Details" query
        db.query.mockResolvedValueOnce([{ cid: 'QmTestCID', filename: 'hot.txt' }]);

        // 4. Mock Pinata call
        pinataService.pinByHash.mockResolvedValue({ success: true });

        // 5. Mock "Insert Replica" query
        db.query.mockResolvedValueOnce({ rowCount: 1 });

        await pinningMonitor.evaluateAndReplicate();

        // Verification
        expect(pinataService.pinByHash).toHaveBeenCalledWith('QmTestCID', 'Replica-hot.txt');
        expect(db.query).toHaveBeenCalledTimes(4); // HotCheck -> ReplicaCheck -> GetDetails -> Insert
    });

    test('should NOT replicate if file already has enough replicas', async () => {
        // 1. Hot File
        db.query.mockResolvedValueOnce([{ file_id: 101, access_count: 10 }]);

        // 2. Check Replicas (Returns 3, Target is 3)
        db.query.mockResolvedValueOnce([
            { id: 1 }, { id: 2 }, { id: 3 }
        ]);

        await pinningMonitor.evaluateAndReplicate();

        expect(db.query).toHaveBeenCalledTimes(2); // HotCheck -> ReplicaCheck
        expect(pinataService.pinByHash).not.toHaveBeenCalled();
    });
});
