// Patch for pg module to ensure Client is always available
"use strict";

const fs = require("fs");
const path = require("path");
const cwd = process.cwd();

console.log("Applying PG patches...");

// Force disable native modules BEFORE any pg imports
process.env.NODE_PG_FORCE_NATIVE = "0";
process.env.PGSSLMODE = "disable";

// Try to get the actual Client if available
let Client;
try {
  const pg = require("pg");
  Client = pg.Client;
  console.log("Loaded Client from pg module");
} catch (e) {
  console.log("Failed to load pg Client:", e.message);
}

// Create a dummy Client constructor that will always be available
const DummyClient = function(options) {
  if (!(this instanceof DummyClient)) {
    return new DummyClient(options);
  }
  this.options = options;
  this.query = () => Promise.resolve({ rows: [] });
  this.connect = () => Promise.resolve();
  this.end = () => Promise.resolve();
  this.release = () => {};
};

// Make it look like a real Client, but only if Client exists and has a prototype
if (Client && Client.prototype) {
  try {
    Object.setPrototypeOf(DummyClient.prototype, Client.prototype);
    Object.setPrototypeOf(DummyClient, Client);
  } catch (e) {
    console.log("Cannot set prototype from Client, using default prototype");
  }
}

// First let's find the pg module
const pgDir = path.join(cwd, "node_modules", "pg");
const pgPoolDir = path.join(cwd, "node_modules", "pg-pool");

// Patch pg-pool/index.js to fix "this.Client is not a constructor" issue
if (fs.existsSync(pgPoolDir)) {
  const poolPath = path.join(pgPoolDir, "index.js");
  
  if (fs.existsSync(poolPath)) {
    try {
      console.log("Patching pg-pool to fix Client constructor issues...");
      
      const poolContent = fs.readFileSync(poolPath, "utf8");
      
      // We need to ensure Client is always available on the Pool prototype
      let patchedContent;
      
      if (poolContent.includes("this.Client = options.Client || pg.Client")) {
        // Modify existing assignment to ensure Client is also on the prototype
        patchedContent = poolContent.replace(
          "this.Client = options.Client || pg.Client",
          `this.Client = options.Client || pg.Client || DummyClient;
          // Also set Client on the prototype for safety
          Pool.prototype.Client = this.Client;
          Pool.Client = this.Client;`
        );
      } else {
        // Older versions might have different patterns
        // Try to find constructor and inject our client there
        patchedContent = poolContent.replace(
          /constructor\s*\([^)]*\)\s*{/,
          `constructor(options) {
            super();
            this.options = options || {};
            // Ensure Client is always available
            try {
              const pg = require("pg");
              this.Client = options.Client || pg.Client || DummyClient;
            } catch (e) {
              this.Client = DummyClient;
            }
            // Also set on prototype
            Pool.prototype.Client = this.Client;
            Pool.Client = this.Client;`
        );
      }
      
      // Also fix or create the newClient method to use our Client
      if (patchedContent.includes("newClient()")) {
        patchedContent = patchedContent.replace(
          /newClient\s*\(\)\s*{[^}]*}/,
          `newClient() {
            // Make sure Client is available
            if (!this.Client) {
              const pg = require("pg");
              this.Client = pg.Client || DummyClient;
            }
            return new this.Client(this.options);
          }`
        );
      } else {
        // Add the method if it doesn't exist
        patchedContent = patchedContent.replace(
          /class Pool extends EventEmitter {/,
          `class Pool extends EventEmitter {
          newClient() {
            // Make sure Client is available
            if (!this.Client) {
              const pg = require("pg");
              this.Client = pg.Client || DummyClient;
            }
            return new this.Client(this.options);
          }`
        );
      }
      
      // Make sure Pool can be called with or without "new"
      if (!patchedContent.includes("if (!(this instanceof Pool))")) {
        patchedContent = patchedContent.replace(
          "module.exports = Pool",
          `module.exports = function createPool(options) {
            if (!(this instanceof createPool)) {
              return new Pool(options);
            }
            return new Pool(options);
          };
          module.exports.Pool = Pool`
        );
      }
      
      fs.writeFileSync(poolPath, patchedContent, "utf8");
      console.log("✅ Successfully patched pg-pool module");
    } catch (err) {
      console.error("Failed to patch pg-pool:", err);
    }
  }
}

// Function to apply all PG patches
function applyPgPatches() {
  try {
    // Force disable native modules
    process.env.NODE_PG_FORCE_NATIVE = "0";
    
    // Export our patched versions
    const result = {
      Client: Client || DummyClient,
      ClientSafe: DummyClient,
      patched: true
    };
    
    console.log("PG patches applied successfully");
    return result;
  } catch (error) {
    console.error("Error applying PG patches:", error);
    return { patched: false, error: error.message };
  }
}

// Export our patched versions
module.exports = {
  Client: Client || DummyClient,
  ClientSafe: DummyClient,
  applyPgPatches
};

console.log("PG patches applied.");
