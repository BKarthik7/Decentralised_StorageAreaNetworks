const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/services/db/client');

const updateReplicas = async () => {
    try {
        console.log("Updating replicas to 'Local'...");
        await db.query("UPDATE replicas SET provider = 'Local' WHERE provider = 'Pinata'");
        console.log("Replicas updated successfully.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

updateReplicas();
