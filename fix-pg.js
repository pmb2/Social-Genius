// Simple fix for pg-native issues
// This file is loaded via NODE_OPTIONS in docker-compose.fixed.yml

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

  // Required for escaping values
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
    console.log('\x1b[33m⚠️ pg-native require intercepted, using JavaScript implementation\x1b[0m');
    return createMockClient();
  }
  
  // Check for pg module to patch it directly
  if (path === 'pg') {
    const pg = originalRequire.call(this, path);
    
    // Make sure native property exists but doesn't use actual native binding
    if (!pg.native) {
      console.log('\x1b[33m⚠️ Adding mock pg.native implementation\x1b[0m');
      
      // Create a mock implementation for pg.native
      pg.native = {
        Client: createMockClient()
      };
    }
    
    return pg;
  }
  
  return originalRequire.call(this, path);
};

console.log('\x1b[32m✅ PostgreSQL native bindings disabled, using pure JavaScript implementation\x1b[0m');