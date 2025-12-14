const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/services/db/client');

const updateAdmin = async () => {
    try {
        console.log('Updating Admin Password...');
        const hash = '$2b$12$938wkUr4j72ripYnDR7Cw.SbjXpd80pzsDeXcfofLvryVhjDyPSlm';
        await db.query("UPDATE users SET password_hash = $1 WHERE email = 'admin@example.com'", [hash]);
        console.log('Admin password updated successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Failed to update admin:', err);
        process.exit(1);
    }
};

updateAdmin();
