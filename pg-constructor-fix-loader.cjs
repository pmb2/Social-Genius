// Runtime constructor fix loader for PostgreSQL
// Applied at startup via NODE_OPTIONS=--require=/app/pg-constructor-fix-loader.cjs
"use strict";

console.log("Applying PostgreSQL constructor fixes at runtime");

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
    
    // Copy prototype and properties
    Object.setPrototypeOf(SafePool.prototype, OriginalPool.prototype);
    Object.setPrototypeOf(SafePool, OriginalPool);
    
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
    function createSafePool(options) {
      if (!(this instanceof createSafePool)) {
        return originalExport(options);
      }
      return originalExport(options);
    }
    
    // Ensure methods and properties are preserved
    Object.keys(originalExport).forEach(key => {
      createSafePool[key] = originalExport[key];
    });
    
    return createSafePool;
  }
  
  return result;
};

console.log("PostgreSQL constructor safety patches applied");
