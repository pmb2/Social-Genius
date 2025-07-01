/**
 * Test script for PostgreSQL patches
 * This script tests whether our pg-native patches are working correctly
 */
'use strict';

console.log('Testing PostgreSQL patches...');

// First verify we're disabling native modules
console.log('Environment variables:');
console.log('NODE_PG_FORCE_NATIVE:', process.env.NODE_PG_FORCE_NATIVE);

// Apply our patches
console.log('\nLoading pg-native-loader.cjs...');
require('./pg-native-loader.cjs');

// Try to directly require pg-native (should use our mock)
console.log('\nTrying to require pg-native directly...');
try {
  const PgNative = require('pg-native');
  console.log('✅ Successfully loaded pg-native mock');
  console.log('Mock client properties:', Object.keys(PgNative.prototype).join(', '));
} catch (err) {
  console.error('❌ Failed to load pg-native mock:', err);
}

// Try loading pg module and check for native property
console.log('\nTrying to load pg module...');
try {
  const pg = require('pg');
  console.log('✅ Successfully loaded pg module');
  
  console.log('\nChecking for pg.native property...');
  if (pg.native) {
    console.log('✅ pg.native exists, mock integration successful');
    console.log('pg.native properties:', Object.keys(pg.native).join(', '));
    
    // Try creating a client from pg.native
    console.log('\nTrying to create a client from pg.native...');
    const client = new pg.native.Client();
    console.log('✅ Successfully created client from pg.native');
    console.log('Client methods:', Object.keys(client).join(', '));
  } else {
    console.log('❌ pg.native is not defined, mock integration failed');
  }
  
  // Check pg.Pool
  console.log('\nChecking pg.Pool...');
  if (pg.Pool) {
    console.log('✅ pg.Pool exists');
    
    // Try creating a pool
    console.log('\nTrying to create a pool...');
    const pool = new pg.Pool();
    console.log('✅ Successfully created pool');
    console.log('Pool properties:', Object.keys(pool).join(', '));
    
    // Check if we can create a pool without "new"
    const pool2 = pg.Pool();
    if (pool2) {
      console.log('✅ Successfully created pool without "new" keyword');
    } else {
      console.log('❌ Failed to create pool without "new" keyword');
    }
  } else {
    console.log('❌ pg.Pool is not defined');
  }
} catch (err) {
  console.error('❌ Failed to load pg module:', err);
}

console.log('\nTest completed.');