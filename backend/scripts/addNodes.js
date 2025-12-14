const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/services/db/client');

const addMissingNodes = async () => {
    try {
        console.log('Adding Delta and Epsilon nodes...');
        const query = `
            INSERT INTO nodes (id, name, location, status, load) VALUES 
            ('node-4', 'Delta Node', 'EU', 'online', 10),
            ('node-5', 'Epsilon Node', 'US', 'online', 5)
            ON CONFLICT (id) DO NOTHING;
        `;
        await db.query(query);
        console.log('Nodes added successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Failed to add nodes:', err);
        process.exit(1);
    }
};

addMissingNodes();
