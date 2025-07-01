// Intercepts require calls for pg-native and returns our mock
"use strict";

const path = require('path');
const Module = require('module');

console.log("Setting up pg-native interceptor...");

// Save the original require
const originalRequire = Module.prototype.require;

// Override the require function
Module.prototype.require = function(modulePath) {
  // When pg-native is requested, return our mock implementation
  if (modulePath === 'pg-native') {
    console.log("Intercepted require for pg-native, loading mock implementation");
    
    // Return our mock implementation
    try {
      const mockPath = path.join(process.cwd(), 'pg-native-mock.cjs');
      // Use the original require to load our mock
      return originalRequire.call(this, mockPath);
    } catch (err) {
      console.error("Failed to load pg-native mock:", err);
      
      // Create a basic mock client if we can't load the file
      const Client = function() {};
      Client.prototype.connect = () => Promise.resolve();
      Client.prototype.query = () => Promise.resolve({ rows: [], rowCount: 0 });
      Client.prototype.end = () => Promise.resolve();
      return Client;
    }
  }
  
  // For all other modules, use the original require
  return originalRequire.apply(this, arguments);
};

// Ensure the environment variable is set
process.env.NODE_PG_FORCE_NATIVE = "0";

console.log("pg-native interceptor setup complete");

module.exports = {
  initialized: true
};