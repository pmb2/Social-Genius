'use strict';

/**
 * Runtime patch for PostgreSQL modules
 * This file is loaded dynamically by postgres-service.ts to fix constructor issues
 * and handle pg-native dependency issues
 */

// First load our pg-native interceptor to handle all future requires
require('./pg-native-loader.cjs');

// Also directly load our mock implementation for immediate use
const MockNative = require('./pg-native-mock.cjs');

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
    
    // Ensure pg.native is available but using our mock
    if (pg && !pg.native) {
      console.log('Adding mock pg.native implementation');
      
      // Create a PG instance using our mock Native client
      const PG = function(clientConstructor) {
        this.Client = clientConstructor;
        this.defaults = pg.defaults;
        this.types = pg.types;
        this.Pool = function(options) {
          return new pg.Pool(Object.assign({}, options, { Client: this.Client }));
        };
      };
      
      // Set our mock native property
      Object.defineProperty(pg, 'native', {
        configurable: true,
        enumerable: false,
        value: new PG(require('./pg-native-mock'))
      });
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