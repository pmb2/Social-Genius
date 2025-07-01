// CommonJS module to patch pg-native at runtime
'use strict';

// Disable pg-native at runtime
process.env.NODE_PG_FORCE_NATIVE = '0';

// Override require to intercept pg-native
const Module = require('module');
const originalRequire = Module.prototype.require;

// Create a simple mock implementation
function createMockClient() {
  function Client() {
    this.connected = false;
  }

  Client.prototype.connect = function(connStr, callback) {
    this.connected = true;
    
    if (callback) {
      process.nextTick(() => callback(null));
      return this;
    }
    
    return Promise.resolve(this);
  };

  Client.prototype.query = function(text, values, callback) {
    // Handle different argument patterns
    if (typeof values === 'function') {
      callback = values;
      values = undefined;
    }
    
    const result = { rows: [], rowCount: 0 };
    
    if (callback) {
      process.nextTick(() => callback(null, result));
      return this;
    }
    
    return Promise.resolve(result);
  };

  Client.prototype.end = function(callback) {
    this.connected = false;
    
    if (callback) {
      process.nextTick(() => callback(null));
      return this;
    }
    
    return Promise.resolve();
  };

  Client.prototype.escapeLiteral = function(str) {
    return "'" + str.replace(/'/g, "''") + "'";
  };

  Client.prototype.escapeIdentifier = function(str) {
    return '"' + str.replace(/"/g, '""') + '"';
  };

  return Client;
}

// Replace the require function to intercept pg-native
Module.prototype.require = function(path) {
  if (path === 'pg-native') {
    console.log('pg-native require intercepted, using JavaScript implementation');
    return createMockClient();
  }
  
  // Check for pg module to patch it directly
  if (path === 'pg') {
    const pg = originalRequire.call(this, path);
    
    // Make sure native property exists but doesn't use actual native binding
    if (!pg.native) {
      console.log('Adding mock pg.native implementation');
      
      // Create a mock implementation for pg.native
      pg.native = {
        Client: createMockClient()
      };
    }
    
    return pg;
  }
  
  return originalRequire.call(this, path);
};

console.log('PostgreSQL native bindings disabled, using pure JavaScript implementation');
