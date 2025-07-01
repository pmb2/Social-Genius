// PostgreSQL Initialization Script for Social Genius
// This script properly initializes the database without requiring pg-native
'use strict';

// Load the pg module safely
const { Pool } = require('pg');

// Ensure pg-native is disabled
process.env.NODE_PG_FORCE_NATIVE = '0';

// Configuration from environment variables
const config = {
  // Database connection URLs
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5435/socialgenius',
  DATABASE_URL_DOCKER: process.env.DATABASE_URL_DOCKER || 'postgresql://postgres:postgres@postgres:5432/socialgenius',
  
  // Docker detection
  RUNNING_IN_DOCKER: process.env.RUNNING_IN_DOCKER === 'true',
  
  // Connection settings
  MAX_RETRIES: 10,
  RETRY_INTERVAL: 2000, // 2 seconds between retries
  
  // SQL script locations
  INIT_SCRIPT: __dirname + '/init-db.sql'
};

console.log('=== DATABASE INITIALIZATION SCRIPT ===');
console.log('Environment:');
console.log('- Running in Docker:', config.RUNNING_IN_DOCKER);
console.log('- Database URL:', config.RUNNING_IN_DOCKER ? 
  config.DATABASE_URL_DOCKER.replace(/:[^:]*@/, ':***@') : 
  config.DATABASE_URL.replace(/:[^:]*@/, ':***@'));

// Create the connection pool
const connectionString = config.RUNNING_IN_DOCKER ? config.DATABASE_URL_DOCKER : config.DATABASE_URL;
const pool = new Pool({
  connectionString,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' && 
       process.env.DATABASE_SSL === 'true' ? 
       { rejectUnauthorized: false } : undefined,
  native: false // Force JavaScript implementation
});

/**
 * Test the database connection with retries
 */
async function testConnection(maxRetries = config.MAX_RETRIES) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Connection attempt ${attempt}/${maxRetries}...`);
      const client = await pool.connect();
      
      try {
        const result = await client.query('SELECT current_timestamp as now');
        const timestamp = result.rows[0].now;
        console.log(`✅ Connected to database! Server time: ${timestamp}`);
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      lastError = err;
      console.error(`Connection attempt ${attempt} failed: ${err.message}`);
      
      if (attempt < maxRetries) {
        console.log(`Waiting ${config.RETRY_INTERVAL/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, config.RETRY_INTERVAL));
      }
    }
  }
  
  console.error('❌ Failed to connect to database after all attempts');
  console.error('Last error:', lastError);
  return false;
}

/**
 * Run database initialization SQL
 */
async function initDatabase() {
  const fs = require('fs');
  const path = require('path');
  
  // Read initialization script
  console.log(`Reading initialization script from ${config.INIT_SCRIPT}`);
  let initSql;
  
  try {
    initSql = fs.readFileSync(config.INIT_SCRIPT, 'utf8');
  } catch (err) {
    console.error(`❌ Failed to read init script: ${err.message}`);
    return false;
  }
  
  console.log('Executing database initialization script...');
  const client = await pool.connect();
  
  try {
    // Split the SQL script into separate statements
    const statements = initSql
      .split(';')
      .filter(statement => statement.trim().length > 0)
      .map(statement => statement.trim());
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement separately
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await client.query(statement);
        
        // Log progress periodically
        if (i % 10 === 0 || i === statements.length - 1) {
          console.log(`Progress: ${i + 1}/${statements.length} statements executed`);
        }
      } catch (err) {
        // Log the error but continue with other statements
        console.error(`Error executing statement #${i + 1}: ${err.message}`);
        console.error('Statement:', statement.substring(0, 100) + '...');
      }
    }
    
    console.log('✅ Database initialization completed');
    return true;
  } catch (err) {
    console.error(`❌ Error during database initialization: ${err.message}`);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Check if tables are already initialized
 */
async function checkTables() {
  const client = await pool.connect();
  try {
    const tables = [
      'users',
      'sessions',
      'businesses',
      'documents',
      'memories'
    ];
    
    const existingTables = [];
    
    for (const table of tables) {
      try {
        const result = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`, [table]);
          
        if (result.rows[0].exists) {
          existingTables.push(table);
        }
      } catch (err) {
        console.error(`Error checking table ${table}: ${err.message}`);
      }
    }
    
    console.log(`Found ${existingTables.length} of ${tables.length} required tables`);
    console.log('Existing tables:', existingTables.join(', ') || 'none');
    
    return existingTables.length === tables.length;
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting database initialization...');
  
  // Step 1: Test connection
  const connected = await testConnection();
  if (!connected) {
    console.error('Could not connect to database, initialization failed');
    process.exit(1);
  }
  
  // Step 2: Check if tables already exist
  const tablesExist = await checkTables();
  
  if (tablesExist) {
    console.log('✅ Database is already initialized, no action needed');
  } else {
    console.log('Database needs initialization, running setup scripts...');
    
    // Step 3: Initialize database
    const initResult = await initDatabase();
    
    if (!initResult) {
      console.error('❌ Database initialization failed');
      process.exit(1);
    }
    
    // Step 4: Verify tables after initialization
    const tablesVerified = await checkTables();
    
    if (tablesVerified) {
      console.log('✅ Database initialization successfully completed!');
    } else {
      console.error('⚠️ Database initialization completed with warnings');
      console.error('Some tables may not have been created correctly');
    }
  }
  
  // Close pool and exit
  await pool.end();
  console.log('Database pool closed, initialization complete');
}

// Run the main function
main().catch(err => {
  console.error('Unhandled error during initialization:', err);
  process.exit(1);
});