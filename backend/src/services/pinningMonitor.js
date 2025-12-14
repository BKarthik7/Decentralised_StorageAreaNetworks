const cron = require('node-cron');
const db = require('./db/client');
const pinataService = require('./pinataService');

// Configuration
const REPLICATION_THRESHOLD = 5; // Accesses in last 7 days to trigger replication
const TARGET_REPLICAS = 3; // Desired number of replicas for hot files
const CHECK_INTERVAL_CRON = '*/15 * * * *'; // Every 15 minutes

const evaluateAndReplicate = async () => {
    console.log('Starting pinning evaluation...');
    try {
        // 1. Find hot files: > threshold accesses in last 7 days
        const hotFiles = await db.query(`
      SELECT file_id, COUNT(*) as access_count
      FROM access_logs
      WHERE access_time > NOW() - INTERVAL '7 days'
      GROUP BY file_id
      HAVING COUNT(*) > $1
    `, [REPLICATION_THRESHOLD]);

        console.log(`Found ${hotFiles.length} hot files.`);

        for (const file of hotFiles) {
            const fileId = file.file_id;

            // 2. Check current replicas
            const replicas = await db.query(
                'SELECT * FROM replicas WHERE file_id = $1 AND status = $2',
                [fileId, 'pinned']
            );

            if (replicas.length < TARGET_REPLICAS) {
                console.log(`File ${fileId} needs replication (current: ${replicas.length}, target: ${TARGET_REPLICAS})`);

                // Get file details (CID)
                const fileDetails = await db.query('SELECT cid, filename FROM files WHERE id = $1', [fileId]);
                if (fileDetails.length === 0) continue;

                const { cid, filename } = fileDetails[0];

                // 3. Pin to additional provider (Simulated by pinning by hash to Pinata again with different metadata, 
                // or ideally this would call a different service like Infura IPFS, Web3.Storage etc.)
                // For this demo, we'll just re-pin to Pinata to simulate "another" pin, 
                // or assume we have a secondary IPFS node configured.

                // Let's assume we use the local IPFS node as the secondary provider if available, 
                // or just log that we are replicating.

                try {
                    // Example: Pin to Pinata (idempotent, but updates metadata)
                    await pinataService.pinByHash(cid, `Replica-${filename}`);

                    // Insert new replica record
                    await db.query(
                        'INSERT INTO replicas (file_id, provider, status) VALUES ($1, $2, $3)',
                        [fileId, 'Pinata-Secondary', 'pinned']
                    );

                    console.log(`Successfully replicated file ${fileId}`);
                } catch (err) {
                    console.error(`Failed to replicate file ${fileId}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('Error in pinning evaluation:', err);
    }
    console.log('Pinning evaluation complete.');
};

const startScheduler = () => {
    console.log(`Starting pinning monitor scheduler (${CHECK_INTERVAL_CRON})`);
    cron.schedule(CHECK_INTERVAL_CRON, () => {
        evaluateAndReplicate();
    });
};

module.exports = {
    evaluateAndReplicate,
    startScheduler
};
