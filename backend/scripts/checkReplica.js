const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/services/db/client');

const checkReplica = async () => {
    try {
        const res = await db.query('SELECT * FROM replicas ORDER BY id DESC LIMIT 1');
        console.log('Latest Replica:', res[0]);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkReplica();
