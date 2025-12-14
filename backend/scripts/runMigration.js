const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/services/db/client');
const fs = require('fs');

const migrate = async () => {
    try {
        console.log('Running manual migration...');
        const sqlPath = path.join(__dirname, '../src/services/db/migrations.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolons to execute statements individually if needed, 
        // or just run the whole block if supported. PG driver supports multiple statements.
        await db.query(sql);
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrate();
