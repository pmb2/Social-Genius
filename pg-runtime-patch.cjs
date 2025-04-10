'use strict';

/**
 * Runtime patch for PostgreSQL modules
 * This file is loaded dynamically by postgres-service.ts to fix constructor issues
 */

module.exports = function applyPgRuntimePatches() {
  console.log('Applying PostgreSQL runtime patches');
  
  // Force disable pg-native to prevent issues
  process.env.NODE_PG_FORCE_NATIVE = '0';
  
  try {
    // Apply patches to the pg module
    const pg = require('pg');
    
    if (pg && pg.Pool) {
      console.log('Patching pg.Pool constructor');
      
      // Store original Pool constructor
      const OriginalPool = pg.Pool;
      
      // Create a safe wrapper that handles both invocation patterns
      function SafePool(options) {
        if (!(this instanceof SafePool)) {
          return new SafePool(options);
        }
        return new OriginalPool(options);
      }
      
      // Copy prototype and properties
      Object.setPrototypeOf(SafePool.prototype, OriginalPool.prototype);
      Object.setPrototypeOf(SafePool, OriginalPool);
      
      // Ensure Client is available
      SafePool.prototype.Client = pg.Client;
      SafePool.Client = pg.Client;
      
      // Replace the Pool constructor
      pg.Pool = SafePool;
      
      console.log('Successfully patched pg.Pool constructor');
    }
    
    // Return the patched modules
    return {
      pg,
      patched: true
    };
  } catch (error) {
    console.error('Error applying PostgreSQL runtime patches:', error);
    return {
      patched: false,
      error: error.message
    };
  }
};