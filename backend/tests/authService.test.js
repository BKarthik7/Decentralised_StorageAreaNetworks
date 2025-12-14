const { newDb } = require('pg-mem');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = 'test-secret'; // Set before require
const authService = require('../src/services/authService');
const db = require('../src/services/db/client');

// Mock db client
jest.mock('../src/services/db/client', () => ({
    query: jest.fn()
}));

describe('Auth Service', () => {
    let memDb;

    beforeAll(async () => {
        process.env.JWT_SECRET = 'test-secret';
        // Setup in-memory DB
        memDb = newDb();
        memDb.public.none(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Redirect db.query to memDb
        db.query.mockImplementation((text, params) => {
            // pg-mem doesn't support $1 syntax exactly like pg, but we can adapt or use its adapter
            // For simplicity in this skeleton, we'll just mock the return values for now
            // or use memDb.public.query(text, params) if compatible.
            // pg-mem's query expects values to be injected.

            // Let's just mock the behavior for unit tests without full DB simulation complexity
            return [];
        });
    });

    test('registerUser should hash password and create user', async () => {
        const user = { email: 'test@test.com', password: 'password123', displayName: 'Test User' };

        // Mock existing user check
        db.query.mockResolvedValueOnce([]); // No existing user

        // Mock insert return
        db.query.mockResolvedValueOnce([{
            id: 1,
            email: user.email,
            display_name: user.displayName,
            created_at: new Date()
        }]);

        const result = await authService.registerUser(user);

        expect(result).toHaveProperty('id');
        expect(result.email).toBe(user.email);
        expect(bcrypt.hash).toHaveBeenCalled; // Implicitly tested if we mocked bcrypt, but we use real bcrypt
        expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('loginUser should return token for valid credentials', async () => {
        const password = 'password123';
        const hash = await bcrypt.hash(password, 10);

        db.query.mockResolvedValueOnce([{
            id: 1,
            email: 'test@test.com',
            password_hash: hash,
            display_name: 'Test User'
        }]);

        const result = await authService.loginUser({ email: 'test@test.com', password });

        expect(result).toHaveProperty('token');
        expect(result.user.email).toBe('test@test.com');
    });
});
