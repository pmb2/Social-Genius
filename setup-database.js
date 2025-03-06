// Database setup script for direct execution on production server

// This script initializes the database tables needed for auth
// Run it directly on the production server with: node setup-database.js

const { Pool } = require('pg');
require('dotenv').config();

async function setupDatabase() {
  console.log('Setting up database tables for authentication...');
  
  // Try multiple connection strings to increase chances of success
  const connectionStrings = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_DOCKER,
    'postgresql://postgres:postgres@postgres:5432/socialgenius',
    'postgresql://postgres:postgres@localhost:5432/socialgenius',
    'postgresql://postgres:postgres@localhost:5435/socialgenius'
  ];
  
  let connected = false;
  let pool;
  
  // Try each connection string until one works
  for (const connectionString of connectionStrings) {
    if (!connectionString) continue;
    
    console.log(`Trying connection string: ${connectionString.substring(0, connectionString.indexOf('@'))}@***`);
    
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000
    });
    
    try {
      await pool.query('SELECT 1');
      console.log(`Successfully connected with: ${connectionString}`);
      connected = true;
      break;
    } catch (error) {
      console.error(`Failed to connect with ${connectionString}:`, error.message);
      await pool.end().catch(() => {});
    }
  }
  
  if (!connected || !pool) {
    console.error('Failed to connect to the database with any connection string.');
    process.exit(1);
  }
  
  try {
    // Create vector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('Vector extension created or already exists');
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('Users table created or already exists');
    
    // Create sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Sessions table created or already exists');
    
    // Create businesses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS businesses (
        id SERIAL PRIMARY KEY,
        business_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'noncompliant',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (business_id, user_id)
      )
    `);
    console.log('Businesses table created or already exists');
    
    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)');
    await pool.query('CREATE INDEX IF NOT EXISTS sessions_id_idx ON sessions(session_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS businesses_user_id_idx ON businesses(user_id)');
    console.log('Indexes created or already exist');
    
    console.log('Database setup completed successfully');
    
    // Close the pool
    await pool.end();
  } catch (error) {
    console.error('Error setting up database:', error);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

setupDatabase();