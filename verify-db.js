// Database verification and initialization script
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

async function verifyDatabase() {
  console.log('Verifying database connection and tables...');
  
  // Try multiple connection strings
  const connectionStrings = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_DOCKER,
    'postgresql://postgres:postgres@localhost:5435/socialgenius',
    'postgresql://postgres:postgres@postgres:5432/socialgenius',
    'postgresql://postgres:postgres@localhost:5432/socialgenius'
  ].filter(Boolean);
  
  console.log('Trying connection strings:', connectionStrings);
  
  for (const connectionString of connectionStrings) {
    console.log(`Testing connection: ${connectionString}`);
    
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 10000
    });
    
    try {
      const client = await pool.connect();
      console.log('✓ Successfully connected to database!');
      
      // Create tables
      console.log('Creating/verifying tables...');
      
      // 1. Enable pgvector extension
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✓ Vector extension enabled');
      } catch (error) {
        console.log('⚠ Vector extension could not be enabled:', error.message);
        console.log('  This may not be a problem if you are not using vector features');
      }
      
      // 2. Create users table
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
      console.log('✓ Users table created/verified');
      
      // 3. Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_id TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Sessions table created/verified');
      
      // 4. Create businesses table
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
      console.log('✓ Businesses table created/verified');
      
      // 5. Create documents table if needed
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id SERIAL PRIMARY KEY,
          collection_name TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata JSONB NOT NULL,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Documents table created/verified');
      
      // 6. Create memories table if needed
      await client.query(`
        CREATE TABLE IF NOT EXISTS memories (
          id SERIAL PRIMARY KEY,
          memory_id TEXT NOT NULL,
          business_id TEXT NOT NULL,
          content TEXT NOT NULL,
          memory_type TEXT NOT NULL,
          is_completed BOOLEAN,
          embedding vector(1536),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Memories table created/verified');
      
      // 7. Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)');
      await client.query('CREATE INDEX IF NOT EXISTS sessions_id_idx ON sessions(session_id)');
      await client.query('CREATE INDEX IF NOT EXISTS businesses_user_id_idx ON businesses(user_id)');
      console.log('✓ Indexes created/verified');
      
      // 8. Check if we need to add a test user
      const userCount = await client.query('SELECT COUNT(*) FROM users');
      
      if (parseInt(userCount.rows[0].count) === 0) {
        console.log('No users found in database. Creating test user...');
        
        // Generate test user with email: test@example.com password: password123
        const testUserEmail = 'test@example.com';
        const testUserHash = '59b3e8d637cf97edbe2384cf59cb7453:83f9304c52a7f8fe41b9888c1ab75b324d93b6b7e9ab79231bc535bf9c8fa1e67295552031d78bb476404ab101604cca49d51b0d639e79c33050f4cbd284d30c';
        const testUserName = 'Test User';
        
        await client.query(`
          INSERT INTO users (email, password_hash, name) 
          VALUES ($1, $2, $3)
          ON CONFLICT (email) DO NOTHING
        `, [testUserEmail, testUserHash, testUserName]);
        
        console.log('✓ Test user created:');
        console.log('  Email: test@example.com');
        console.log('  Password: password123');
      } else {
        console.log(`✓ Users table has ${userCount.rows[0].count} existing users`);
      }
      
      // Save the working connection string to a file that can be read later
      fs.writeFileSync('.db-connection', connectionString);
      console.log(`✓ Database connection string saved: ${connectionString}`);
      
      // Clean up and exit
      client.release();
      await pool.end();
      
      console.log('✓ Database verification completed successfully!');
      return true;
    } catch (error) {
      console.error(`✗ Error with connection string ${connectionString}:`, error.message);
      try {
        await pool.end();
      } catch {}
    }
  }
  
  console.error('✗ Failed to connect to database with any connection string');
  return false;
}

// Run the verification
verifyDatabase()
  .then(success => {
    if (success) {
      console.log('✓ Database is ready for authentication!');
      process.exit(0);
    } else {
      console.error('✗ Database verification failed');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('✗ Unexpected error during database verification:', err);
    process.exit(1);
  });
