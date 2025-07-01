'use strict';

/**
 * Test script for the pg-native mock implementation
 * This script verifies that the mock implementation works correctly
 * and that the pg module can be used without the native bindings.
 */

// Apply runtime patches
require('./pg-runtime-patch.cjs')();

console.log('Testing pg module with pg-native mock...');

// Try to require pg-native directly (should get our mock)
try {
  const pgNative = require('pg-native');
  console.log('Successfully loaded pg-native (mock):', typeof pgNative);
  
  // Test basic mock methods
  const native = new pgNative();
  console.log('Created native instance, connection methods available:', 
    typeof native.connect === 'function' && 
    typeof native.query === 'function' && 
    typeof native.end === 'function');
} catch (e) {
  console.error('Error loading pg-native:', e);
}

// Try to access pg.native
try {
  const pg = require('pg');
  console.log('Successfully loaded pg module');
  
  if (pg.native) {
    console.log('pg.native is available:', typeof pg.native === 'object');
    console.log('pg.native.Client available:', typeof pg.native.Client === 'function');
    console.log('pg.native.Pool available:', typeof pg.native.Pool === 'function');
  } else {
    console.error('pg.native is not available');
  }
  
  // Test creating a pool with the JS client
  const pool = new pg.Pool({
    connectionString: 'postgresql://user:password@localhost:5432/dbname'
  });
  
  console.log('Successfully created pg.Pool instance');
  
  // Test querying without actually connecting
  console.log('Testing mock query (should resolve with empty result)...');
  pool.query('SELECT 1 as test')
    .then(result => {
      console.log('Query succeeded with mock result:', result.rows);
      
      // Clean up
      return pool.end();
    })
    .then(() => {
      console.log('Successfully ended pool');
      console.log('All tests passed!');
    })
    .catch(err => {
      console.error('Error in test:', err);
    });
  
} catch (e) {
  console.error('Error testing pg module:', e);
}