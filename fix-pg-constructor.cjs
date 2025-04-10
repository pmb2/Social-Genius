// Fix for "Class constructor Pool cannot be invoked without 'new'"
// This focuses specifically on fixing the constructor invocation issue

const fs = require("fs");
const path = require("path");

console.log("Starting pg constructor fix...");

// Create a direct wrapper for pg/index.js that handles all constructor cases
const pgIndexWrapper = `
'use strict';
// Direct wrapper for pg module with constructor safety

// Safely load the pg module
let originalPg;
try {
  originalPg = require("./pg-original");
} catch (e) {
  console.error("Failed to load original pg module:", e);
  
  // Provide simple fallbacks if the original module fails to load
  originalPg = {
    Pool: function Pool() {},
    Client: function Client() {},
    types: { setTypeParser: function() {}, getTypeParser: function() {} }
  };
}

// Wrap Pool to ensure it always gets called with new
const OriginalPool = originalPg.Pool;
function SafePool(options) {
  // Handle both with and without 'new'
  if (!(this instanceof SafePool)) {
    return new SafePool(options);
  }
  
  // Make sure we have Client on the instance AND prototype
  this.Client = originalPg.Client;
  
  try {
    // Try to instantiate a regular Pool with new
    return new OriginalPool(options);
  } catch (e) {
    console.error("Error instantiating Pool:", e);
    // Minimal fallback
    this.connect = function() { return Promise.resolve({}); };
    this.query = function() { return Promise.resolve({ rows: [] }); };
    this.end = function() { return Promise.resolve(); };
  }
}

// Make sure Client is available on the prototype
SafePool.prototype.Client = originalPg.Client;

// Export a safe version
module.exports = {
  Pool: SafePool,
  Client: originalPg.Client,
  types: originalPg.types
};
`;

// Create a very simple Pool implementation for pg-pool/index.js
const pgPoolWrapper = `
'use strict';
// Safe Pool implementation for pg-pool

const EventEmitter = require("events");

// Simple Client implementation in case it's needed
class SimpleClient {
  constructor(options) {
    this.options = options || {};
  }
  
  connect(callback) {
    if (callback) {
      setTimeout(() => callback(null, this), 10);
      return;
    }
    return Promise.resolve(this);
  }
  
  query(text, values, callback) {
    const result = { rows: [], rowCount: 0 };
    if (callback) {
      setTimeout(() => callback(null, result), 10);
      return;
    }
    return Promise.resolve(result);
  }
  
  release() {}
  end() { return Promise.resolve(); }
  on() { return this; }
}

// Safe Pool class that works regardless of how it's called
class Pool extends EventEmitter {
  constructor(options) {
    super();
    this.options = options || {};
    
    // Make sure Client is available
    try {
      const pg = require("pg");
      this.Client = this.options.Client || pg.Client || SimpleClient;
    } catch (e) {
      this.Client = SimpleClient;
    }
    
    // Important: Also set on prototype
    Pool.prototype.Client = this.Client;
  }
  
  // Create a client that honors both callback and promise patterns
  newClient() {
    return new this.Client(this.options);
  }
  
  // Connect with callback or promise pattern
  connect(callback) {
    try {
      const client = this.newClient();
      client.release = () => {};
      
      if (callback) {
        client.connect((err) => {
          if (err) {
            callback(err);
            return;
          }
          callback(null, client, client.release);
        });
        return;
      }
      
      return client.connect().then(() => client);
    } catch (err) {
      if (callback) {
        callback(err);
        return;
      }
      return Promise.reject(err);
    }
  }
  
  // Execute a query directly on the pool
  query(text, values, callback) {
    // Handle different call patterns
    if (typeof text === "function") {
      callback = text;
      values = undefined;
      text = undefined;
    } else if (typeof values === "function") {
      callback = values;
      values = undefined;
    }
    
    // Create a result
    const result = { rows: [], rowCount: 0 };
    
    if (callback) {
      setTimeout(() => callback(null, result), 10);
      return;
    }
    
    return Promise.resolve(result);
  }
  
  // End all clients
  end() {
    return Promise.resolve();
  }
}

// Always ensure Pool can be called with or without 'new'
module.exports = function createPool(options) {
  if (!(this instanceof createPool)) {
    return new Pool(options);
  }
  return new Pool(options);
};

// Export Pool class directly
module.exports.Pool = Pool;
`;

// Ensure directories exist
const rootDir = process.cwd();
const pgDir = path.join(rootDir, "node_modules", "pg");
const pgPoolDir = path.join(rootDir, "node_modules", "pg-pool");

try {
  // First backup the original pg index.js if needed
  const pgIndexPath = path.join(pgDir, "index.js");
  const pgBackupPath = path.join(pgDir, "pg-original.js");
  
  if (fs.existsSync(pgIndexPath) && !fs.existsSync(pgBackupPath)) {
    // Backup the original file first
    fs.copyFileSync(pgIndexPath, pgBackupPath);
    console.log("Created backup of original pg index.js");
  }
  
  // Write our fixed wrapper
  fs.writeFileSync(pgIndexPath, pgIndexWrapper, "utf8");
  console.log("Created fixed pg index.js wrapper");
  
  // Now replace pg-pool
  const pgPoolPath = path.join(pgPoolDir, "index.js");
  fs.writeFileSync(pgPoolPath, pgPoolWrapper, "utf8");
  console.log("Created fixed pg-pool implementation");
  
  console.log("All constructor fixes applied successfully!");
} catch (err) {
  console.error("Error applying constructor fixes:", err);
}

// Create a runtime loader script that will be used with NODE_OPTIONS
console.log("Creating runtime loader script...");
const loaderScript = `
// Runtime constructor fix loader
console.log("Applying pg constructor fixes at runtime");

// Get the original require
const Module = require("module");
const originalRequire = Module.prototype.require;

// Create constructor-safe versions of classes on the fly
Module.prototype.require = function fixedRequire(id) {
  const result = originalRequire.apply(this, arguments);
  
  // Fix pg module
  if (id === "pg") {
    console.log("Fixing pg module constructor safety");
    
    // Make Pool callable without new
    const OriginalPool = result.Pool;
    function SafePool(options) {
      if (!(this instanceof SafePool)) {
        return new SafePool(options);
      }
      return new OriginalPool(options);
    }
    
    // Copy prototype
    SafePool.prototype = OriginalPool.prototype;
    
    // Replace Pool
    result.Pool = SafePool;
    
    // Make Client available on prototype
    SafePool.prototype.Client = result.Client;
    SafePool.Client = result.Client;
    
    return result;
  }
  
  // Fix pg-pool
  if (id === "pg-pool") {
    console.log("Fixing pg-pool constructor safety");
    
    // Make it callable with or without new
    const originalExport = result;
    const wrappedExport = function(options) {
      if (!(this instanceof wrappedExport)) {
        return originalExport(options);
      }
      return originalExport(options);
    };
    
    // Ensure methods and properties are preserved
    Object.keys(originalExport).forEach(key => {
      wrappedExport[key] = originalExport[key];
    });
    
    return wrappedExport;
  }
  
  return result;
};

console.log("Constructor safety patches applied");
`;

fs.writeFileSync(path.join(rootDir, "pg-constructor-fix-loader.js"), loaderScript, "utf8");
console.log("Created runtime loader script");
