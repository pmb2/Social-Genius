// Create a test user directly in the database for debugging
const { Pool } = require('pg');
const crypto = require('crypto');

// Force disable native
process.env.NODE_PG_FORCE_NATIVE = '0';

// Use the environment variable or default to localhost
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/socialgenius';

console.log(`Connecting to database with: ${connectionString.split('@')[0]}@***@${connectionString.split('@')[1]}`);

const pool = new Pool({
  connectionString,
  ssl: false,
  native: false
});

// Function to create a hashed password
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function createTestUser() {
  const client = await pool.connect();
  
  try {
    // First ensure the users table exists
    console.log('Checking if users table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Users table does not exist, creating it...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT NOT NULL,
          profile_picture TEXT,
          phone_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
        );
      `);
    }
    
    // Check if test user already exists
    console.log('Checking if test user already exists...');
    const userCheck = await client.query('SELECT id FROM users WHERE email = $1', ['test@example.com']);
    
    if (userCheck.rows.length > 0) {
      console.log('Test user already exists with ID:', userCheck.rows[0].id);
      return userCheck.rows[0].id;
    }
    
    // Create the test user
    const passwordHash = hashPassword('password123');
    console.log('Creating test user with hashed password...');
    console.log('Password hash format:', passwordHash.substring(0, 10) + '...');
    
    const result = await client.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['test@example.com', 'Test User', passwordHash]
    );
    
    console.log('Test user created with ID:', result.rows[0].id);
    console.log('Login with:');
    console.log('- Email: test@example.com');
    console.log('- Password: password123');
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the function
createTestUser()
  .then(id => {
    console.log('Successfully created test user with ID:', id);
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to create test user:', err);
    process.exit(1);
  });