// Script to verify database connection and initialize tables if needed
const { Pool } = require('pg');
require('dotenv').config();

async function initDb() {
  const connectionStrings = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_DOCKER,
    'postgresql://postgres:postgres@localhost:5435/socialgenius',
    'postgresql://postgres:postgres@postgres:5432/socialgenius',
    'postgresql://postgres:postgres@localhost:5432/socialgenius'
  ];

  // Try each connection string
  for (const connectionString of connectionStrings) {
    if (!connectionString) continue;
    
    console.log(`Trying connection with: ${connectionString.substring(0, connectionString.indexOf('@'))}@***`);
    
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000
    });
    
    try {
      // Test connection
      const client = await pool.connect();
      console.log('Connected to database, verifying tables...');
      
      // Check if tables exist
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'sessions', 'businesses')
      `);
      
      if (tablesResult.rows.length < 3) {
        console.log('Some tables are missing, creating them...');
        
        // Create vector extension
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        
        // Create users table if it doesn't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP WITH TIME ZONE
          )
        `);
        
        // Create sessions table if it doesn't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            session_id TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Create businesses table if it doesn't exist
        await client.query(`
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
        
        // Create indexes
        await client.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`);
        await client.query(`CREATE INDEX IF NOT EXISTS sessions_id_idx ON sessions(session_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS businesses_user_id_idx ON businesses(user_id)`);
        
        console.log('Tables created successfully');
      } else {
        console.log('All required tables exist');
      }
      
      console.log('Database verification complete');
      
      // Close the client
      client.release();
      await pool.end();
      
      console.log('Successfully verified database with connection string:', connectionString);
      
      // Export the working connection string
      process.env.DATABASE_URL = connectionString;
      
      // Exit with success
      process.exit(0);
    } catch (error) {
      console.error(`Failed to connect with ${connectionString}:`, error.message);
      await pool.end().catch(() => {});
    }
  }
  
  console.error('All connection attempts failed. Please check your database configuration.');
  process.exit(1);
}

initDb();