#!/usr/bin/env node

// Simple script to test and fix database connection
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

// Fix pg-pool module to prevent "super keyword unexpected" error
async function fixPgPool() {
  try {
    console.log('Fixing pg-pool module...');

    // Path to the pg-pool index.js file
    const pgPoolPath = path.join(process.cwd(), 'node_modules', 'pg-pool', 'index.js');

    // Check if the file exists
    if (!fs.existsSync(pgPoolPath)) {
      console.error('ERROR: pg-pool module not found at:', pgPoolPath);
      
      // Try to find pg-pool in nested node_modules
      const pgPath = path.join(process.cwd(), 'node_modules', 'pg', 'node_modules', 'pg-pool', 'index.js');
      if (fs.existsSync(pgPath)) {
        console.log('Found pg-pool in pg/node_modules:', pgPath);
        return fixPoolFile(pgPath);
      }
      
      console.error('Could not find pg-pool module. Database connections may fail.');
      return false;
    }

    return fixPoolFile(pgPoolPath);
  } catch (error) {
    console.error('Error fixing pg-pool:', error);
    return false;
  }
}

function fixPoolFile(filePath) {
  try {
    // Read the original file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the file already has our fix
    if (content.includes('// Fixed by db-fix.mjs')) {
      console.log('pg-pool already fixed, skipping.');
      return true;
    }
    
    // Check if the file contains a Pool class
    if (!content.includes('class Pool')) {
      console.error('Unable to find Pool class in pg-pool module.');
      return false;
    }
    
    console.log('Found Pool class in pg-pool module, applying fix.');
    
    // Apply the fix - remove "super()" from constructor
    const fixedContent = content
      // Add a marker to indicate the file has been fixed
      .replace('class Pool {', 'class Pool { // Fixed by db-fix.mjs')
      // Remove or safely handle any super() calls
      .replace(/\s*super\(\);?\s*/, '\n    // super() call removed by db-fix.mjs\n    ');
    
    // Write the fixed file
    fs.writeFileSync(filePath, fixedContent, 'utf8');
    console.log('Successfully fixed pg-pool module at', filePath);
    return true;
  } catch (error) {
    console.error('Error fixing pg-pool file:', error);
    return false;
  }
}

// Run the pg-pool fix
await fixPgPool();

// Force disable native module
process.env.NODE_PG_FORCE_NATIVE = '0';

// Check if we're running in Docker
const runningInDocker = process.env.RUNNING_IN_DOCKER === 'true';

// Set connection string based on environment
let connectionString;
if (runningInDocker) {
  connectionString = 'postgresql://postgres:postgres@postgres:5432/socialgenius';
  console.log('Using Docker database connection (service name)');
} else {
  connectionString = 'postgresql://postgres:postgres@localhost:5435/socialgenius';
  console.log('Using local database connection');
}

console.log(`Connecting to PostgreSQL with: ${connectionString}`);

// Create a new PostgreSQL connection pool
const pool = new Pool({
  connectionString,
  ssl: false,
  max: 5,
  idleTimeoutMillis: 60000,
  native: false, // Force JavaScript implementation
});

// Handle pool connection errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function testDatabase() {
  let client;
  try {
    console.log('Attempting to connect to database...');
    client = await pool.connect();
    console.log('Successfully connected to database!');
    
    // Execute a test query
    const result = await client.query('SELECT version()');
    console.log('Database version:', result.rows[0].version);
    
    // Check if tables exist
    const tableResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `);
    
    if (tableResult.rows[0].exists) {
      console.log('Users table exists');
      
      // Count users
      const usersCount = await client.query('SELECT COUNT(*) FROM users');
      console.log(`Found ${usersCount.rows[0].count} users in the database`);
      
      // Check test user
      const testUser = await client.query("SELECT * FROM users WHERE email = 'test@example.com'");
      if (testUser.rows.length > 0) {
        console.log('Test user exists:', testUser.rows[0].email);
      } else {
        console.log('Test user does not exist, creating...');
        
        // Hash for 'password123'
        const passwordHash = '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa';
        
        await client.query(`
          INSERT INTO users (email, password_hash, name, created_at, updated_at)
          VALUES ('test@example.com', $1, 'Test User', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [passwordHash]);
        
        console.log('Created test user: test@example.com / password123');
      }
    } else {
      console.log('❌ Users table does not exist, database may need initialization');
    }
    
    console.log('✅ Database connection test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testDatabase()
  .then(success => {
    if (success) {
      console.log('Database connection is working correctly');
      process.exit(0);
    } else {
      console.error('Database connection is not working');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Error during database test:', err);
    process.exit(1);
  });