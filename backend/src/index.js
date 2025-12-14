require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const filesRoutes = require('./routes/files');
const { startScheduler } = require('./services/pinningMonitor');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes); // uploadRoutes mounts at /upload inside the file usually, but let's check. 
// upload.js has router.post('/upload', ...). So if we mount at /api, it is /api/upload. Correct.
app.use('/api/files', filesRoutes);
app.use('/api/admin', require('./routes/admin'));

// Start Pinning Monitor
startScheduler();

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
