'use strict';

/**
 * pg-native loader
 * This module intercepts requires for pg-native and returns a mock implementation
 * when the actual module is unavailable.
 * 
 * Usage:
 * 1. Require this file early in your application:
 *    require('./pg-native-loader')
 *    
 * 2. Make sure NODE_PG_FORCE_NATIVE is set to '0' to disable native mode
 *    process.env.NODE_PG_FORCE_NATIVE = '0';
 */

// Save original require function
const Module = require('module');
const originalRequire = Module.prototype.require;

// Override require to intercept pg-native requests
Module.prototype.require = function mockRequire(moduleName) {
  // Intercept pg-native requires
  if (moduleName === 'pg-native') {
    console.log('Intercepted require for pg-native, returning mock implementation');
    // Return our mock implementation
    return require('./pg-native-mock');
  }
  
  // Proceed with normal require for all other modules
  return originalRequire.apply(this, arguments);
};

// Add a reference so we can restore the original require if needed
Module.prototype._originalRequire = originalRequire;

// Enable process.env flag to ensure pg uses JavaScript client
process.env.NODE_PG_FORCE_NATIVE = '0';

console.log('pg-native loader installed - all requires for pg-native will use mock implementation');

// Export a function to restore the original require
module.exports = {
  uninstall: function() {
    if (Module.prototype._originalRequire) {
      Module.prototype.require = Module.prototype._originalRequire;
      delete Module.prototype._originalRequire;
      console.log('pg-native loader uninstalled - restored original require');
    }
  }
};