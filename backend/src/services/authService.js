const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db/client');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined!');
}

const registerUser = async ({ email, password, displayName }) => {
    // Check if user exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
        throw new Error('User already exists');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const rows = await db.query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, created_at',
        [email, passwordHash, displayName]
    );

    return rows[0];
};

const loginUser = async ({ email, password }) => {
    const rows = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) {
        throw new Error('Invalid credentials');
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );

    return {
        user: {
            id: user.id,
            email: user.email,
            displayName: user.display_name
        },
        token
    };
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        throw new Error('Invalid token');
    }
};

module.exports = {
    registerUser,
    loginUser,
    verifyToken
};
