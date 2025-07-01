// This file is preloaded via NODE_OPTIONS to fix pg-native issues
console.log('Loading pg-preload.js to fix pg-native issues');

// Disable pg-native at the earliest possible point
process.env.NODE_PG_FORCE_NATIVE = '0';

// Override require to handle pg-native directly
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function mockRequire(moduleName) {
  // Intercept pg-native requires
  if (moduleName === 'pg-native') {
    console.log('⚠️ Intercepted require for pg-native, returning mock implementation');
    
    // Return a mock implementation
    function Client() {
      this.connected = false;
    }
    
    Client.prototype.connect = function() {
      this.connected = true;
      return Promise.resolve(this);
    };
    
    Client.prototype.query = function() {
      return Promise.resolve({ rows: [], rowCount: 0 });
    };
    
    Client.prototype.end = function() {
      this.connected = false;
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
  
  // For all other modules, use the original require
  return originalRequire.apply(this, arguments);
};

console.log('✅ pg-native mock implementation installed');