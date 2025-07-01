#!/usr/bin/env node

// Simple script to test and fix database connection
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Apply pg patch to fix connection issues
try {
  require('./pg-patch.cjs');
  console.log('✅ pg-patch applied successfully');
} catch (error) {
  console.error('Failed to apply pg-patch:', error);
}

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
  native: false // Force JavaScript implementation
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
    } else {
      console.log('❌ Users table does not exist, database may need initialization');
    }
    
    console.log('✅ Database connection test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
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