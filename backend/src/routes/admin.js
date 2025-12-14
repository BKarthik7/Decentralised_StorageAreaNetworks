const express = require('express');
const router = express.Router();
const db = require('../services/db/client');
const { evaluateAndReplicate } = require('../services/pinningMonitor');

// Mock Node Data (In a real system this would be dynamic or in DB)
// Mock Node Data Removed - Using DB
// const systemNodes = ...

// Mock Event Log
let eventLog = [];

const addLog = (type, message) => {
    const log = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type,
        message
    };
    eventLog.unshift(log);
    if (eventLog.length > 50) eventLog.pop(); // Keep last 50
    return log;
};

// GET /api/admin/system-state
router.get('/system-state', async (req, res) => {
    try {
        // Fetch real stats from DB
        const fileCountRes = await db.query('SELECT COUNT(*) FROM files');
        const replicaCountRes = await db.query('SELECT COUNT(*) FROM replicas');
        const totalSizeRes = await db.query('SELECT SUM(size) FROM files');
        const nodesRes = await db.query('SELECT * FROM nodes');

        const fileCount = parseInt(fileCountRes[0].count) || 0;
        const replicaCount = parseInt(replicaCountRes[0].count) || 0;
        const totalSize = parseInt(totalSizeRes[0].sum || 0) || 0;
        const systemNodes = nodesRes; // Use DB nodes

        res.json({
            nodes: systemNodes,
            stats: {
                files: fileCount,
                replicas: replicaCount,
                storageUsed: totalSize
            },
            logs: eventLog
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch system state' });
    }
});

// POST /api/admin/simulate/node-failure
router.post('/simulate/node-failure', async (req, res) => {
    const { nodeId } = req.body;

    try {
        const nodeRes = await db.query('SELECT * FROM nodes WHERE id = $1', [nodeId]);
        if (nodeRes.length > 0) {
            const node = nodeRes[0];
            await db.query('UPDATE nodes SET status = $1 WHERE id = $2', ['offline', nodeId]);

            addLog('CRITICAL', `Node ${node.name} (${nodeId}) went OFFLINE`);

            // Trigger recovery logic
            setTimeout(async () => {
                try {
                    addLog('SYSTEM', `Detecting under-replicated shards for node ${node.name}...`);

                    // 1. Find shards held by this node
                    const shardsToMoveRes = await db.query('SELECT COUNT(*) FROM key_shards WHERE holder = $1', [node.name]);
                    const shardCount = parseInt(shardsToMoveRes[0].count);

                    if (shardCount > 0) {
                        // 2. Find an online target node
                        const targetNodeRes = await db.query("SELECT * FROM nodes WHERE status = 'online' AND id != $1 ORDER BY load ASC LIMIT 1", [nodeId]);

                        if (targetNodeRes.length > 0) {
                            const targetNode = targetNodeRes[0];
                            addLog('RECOVERY', `Found ${shardCount} shards. Migrating to ${targetNode.name}...`);

                            // 3. Move shards
                            await db.query('UPDATE key_shards SET holder = $1 WHERE holder = $2', [targetNode.name, node.name]);

                            // 4. Update Load (Simulated)
                            await db.query('UPDATE nodes SET load = load + $1 WHERE id = $2', [Math.ceil(shardCount / 2), targetNode.id]);

                            addLog('SUCCESS', `Successfully migrated ${shardCount} shards to ${targetNode.name}. System stability restored.`);
                        } else {
                            addLog('CRITICAL', 'Recovery Failed: No online nodes available to accept shards!');
                        }
                    } else {
                        addLog('INFO', `Node ${node.name} held no shards. No migration needed.`);
                    }
                } catch (err) {
                    console.error('Recovery Logic Error:', err);
                    addLog('ERROR', 'Recovery process encountered an internal error.');
                }
            }, 2000);

            res.json({ success: true, message: `Node ${node.name} marked offline` });
        } else {
            res.status(404).json({ error: 'Node not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to simulate failure' });
    }
});

// POST /api/admin/simulate/node-recovery
router.post('/simulate/node-recovery', async (req, res) => {
    const { nodeId } = req.body;
    try {
        const nodeRes = await db.query('SELECT * FROM nodes WHERE id = $1', [nodeId]);
        if (nodeRes.length > 0) {
            const node = nodeRes[0];
            await db.query('UPDATE nodes SET status = $1 WHERE id = $2', ['online', nodeId]);

            // Simulate System Rebalancing
            setTimeout(async () => {
                try {
                    addLog('SYSTEM', `Analyzing load distribution for recovered node ${node.name}...`);

                    // 1. Check if recovered node is empty
                    const myShardsRes = await db.query('SELECT COUNT(*) FROM key_shards WHERE holder = $1', [node.name]);
                    const myCount = parseInt(myShardsRes[0].count);

                    if (myCount === 0) {
                        // 2. Find heaviest node (highest load)
                        // Note: We use shard count as load here for accuracy
                        const heaviestNodeRes = await db.query(`
                            SELECT holder, COUNT(*) as count 
                            FROM key_shards 
                            GROUP BY holder 
                            ORDER BY count DESC 
                            LIMIT 1
                        `);

                        if (heaviestNodeRes.length > 0) {
                            const heaviestNode = heaviestNodeRes[0].holder;
                            const heavyCount = parseInt(heaviestNodeRes[0].count);

                            if (heavyCount > 1) { // Only rebalance if there's enough to share
                                const moveCount = Math.floor(heavyCount / 2);
                                addLog('BALANCING', `Node ${heaviestNode} is overloaded (${heavyCount} shards). Moving ${moveCount} shards to ${node.name}...`);

                                // 3. Move shards using subquery for LIMIT
                                await db.query(`
                                    UPDATE key_shards 
                                    SET holder = $1 
                                    WHERE id IN (
                                        SELECT id FROM key_shards 
                                        WHERE holder = $2 
                                        LIMIT $3
                                    )
                                `, [node.name, heaviestNode, moveCount]);

                                // 4. Update Loads (Simulated)
                                await db.query('UPDATE nodes SET load = load - $1 WHERE name = $2', [moveCount * 10, heaviestNode]); // arbitrary load points
                                await db.query('UPDATE nodes SET load = load + $1 WHERE id = $2', [moveCount * 10, nodeId]);

                                addLog('SUCCESS', `Rebalancing complete. ${node.name} now holds ${moveCount} active shards.`);
                            } else {
                                addLog('INFO', 'Network load is balanced. No migration needed.');
                            }
                        } else {
                            addLog('INFO', 'No active shards in network to rebalance.');
                        }
                    }
                } catch (err) {
                    console.error('Rebalancing Logic Error:', err);
                    addLog('ERROR', 'Rebalancing encountered an error.');
                }
            }, 2000);

            res.json({ success: true, message: `Node ${node.name} marked online` });
        } else {
            res.status(404).json({ error: 'Node not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to simulate recovery' });
    }
});

// POST /api/admin/trigger-replication
router.post('/trigger-replication', async (req, res) => {
    try {
        addLog('MANUAL', 'Admin triggered manual replication check');
        await evaluateAndReplicate();
        addLog('SUCCESS', 'Replication check completed');
        res.json({ success: true, message: 'Replication triggered' });
    } catch (err) {
        addLog('ERROR', `Replication failed: ${err.message}`);
        res.status(500).json({ error: 'Replication failed' });
    }
});

// GET /api/admin/blockchain
router.get('/blockchain', async (req, res) => {
    try {
        if (!process.env.ETH_PROVIDER_URL) {
            return res.json({
                connected: false,
                error: 'Blockchain provider not configured'
            });
        }

        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.ETH_PROVIDER_URL);

        // 1. Get Network Stats
        const blockNumber = await provider.getBlockNumber();
        const feeData = await provider.getFeeData();
        const network = await provider.getNetwork();

        // 2. Fetch Recent Blocks (Last 5)
        const blocks = [];
        const recentTxs = [];
        const limit = 5;
        const startBlock = Math.max(0, blockNumber - limit + 1);

        for (let i = blockNumber; i >= startBlock; i--) {
            const block = await provider.getBlock(i, true); // true = include transactions
            if (block) {
                blocks.push({
                    number: block.number,
                    hash: block.hash,
                    timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                    txCount: block.prefetchedTransactions.length,
                    gasUsed: block.gasUsed.toString(),
                    gasLimit: block.gasLimit.toString()
                });

                // Extract Transactions from this block
                block.prefetchedTransactions.forEach(tx => {
                    recentTxs.push({
                        hash: tx.hash,
                        blockNumber: i,
                        from: tx.from,
                        to: tx.to,
                        value: ethers.formatEther(tx.value),
                        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : '0'
                    });
                });
            }
        }

        res.json({
            connected: true,
            network: {
                name: 'Ganache Local',
                chainId: Number(network.chainId),
                height: blockNumber,
                gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : '0'
            },
            blocks,
            transactions: recentTxs.slice(0, 10) // Limit to 10 recent txs
        });

    } catch (err) {
        console.error('Blockchain Fetch Error:', err);
        res.status(500).json({ error: 'Failed to fetch blockchain data', details: err.message });
    }
});

module.exports = router;
