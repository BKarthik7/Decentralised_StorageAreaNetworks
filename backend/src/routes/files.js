const express = require('express');
const db = require('../services/db/client');
const jwtAuth = require('../middleware/jwtAuth');

const router = express.Router();

// List files for the authenticated user
router.get('/', jwtAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const files = await db.query(
            'SELECT * FROM files WHERE uploader_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json(files);
    } catch (err) {
        console.error('Error listing files:', err);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

// Get file details (including encryption status/shards info if needed)
router.get('/:id', jwtAuth, async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.id;

        const files = await db.query(
            'SELECT * FROM files WHERE id = $1 AND uploader_id = $2',
            [fileId, userId]
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = files[0];

        // Check for shards
        const shards = await db.query(
            'SELECT shard_index, holder FROM key_shards WHERE file_id = $1',
            [fileId]
        );

        res.json({
            ...file,
            isEncrypted: shards.length > 0,
            shards: shards // Don't return the actual shard_ref (key part) unless necessary or authorized specifically
        });
    } catch (err) {
        console.error('Error getting file details:', err);
        res.status(500).json({ error: 'Failed to get file details' });
    }
});

router.get('/:id/details', jwtAuth, async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.userId;

        // 1. Get File Info
        const fileRes = await db.query(
            'SELECT * FROM files WHERE id = $1 AND uploader_id = $2',
            [fileId, userId]
        );

        if (fileRes.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = fileRes[0];

        // 2. Get Replicas
        const replicaRes = await db.query(
            'SELECT * FROM replicas WHERE file_id = $1',
            [fileId]
        );

        // 3. Get Key Shards
        const shardRes = await db.query(
            'SELECT * FROM key_shards WHERE file_id = $1',
            [fileId]
        );

        res.json({
            file,
            replicas: replicaRes,
            shards: shardRes
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch file details' });
    }
});

module.exports = router;
