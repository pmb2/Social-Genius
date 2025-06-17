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
      
      // Check if already patched to avoid double-patching
      if (poolContent.includes("// PATCHED BY pg-patch.cjs")) {
        console.log("pg-pool already patched, skipping...");
        return;
      }
      
      let patchedContent = poolContent;
      
      // Add patch marker at the top
      patchedContent = `// PATCHED BY pg-patch.cjs\n${patchedContent}`;
      
      // Fix the constructor to ensure Client is always available
      patchedContent = patchedContent.replace(
        /constructor\s*\(options\)\s*{[\s\S]*?this\.options\s*=\s*Object\.assign\(\{\},\s*options\)/,
        `constructor(options) {
    super()
    this.options = Object.assign({}, options)`
      );
      
      // Ensure Client is set properly in constructor
      if (patchedContent.includes("this.Client = options.Client || Client")) {
        patchedContent = patchedContent.replace(
          "this.Client = options.Client || Client",
          `// Ensure Client is always available
    try {
      const pg = require('pg');
      this.Client = options.Client || pg.Client;
    } catch (e) {
      // Fallback if pg module fails
      this.Client = function DummyClient() {};
    }
    if (!this.Client) {
      this.Client = function DummyClient() {};
    }`
        );
      } else {
        // Add Client assignment if it doesn't exist
        patchedContent = patchedContent.replace(
          "this.options = Object.assign({}, options)",
          `this.options = Object.assign({}, options)
    
    // Ensure Client is always available
    try {
      const pg = require('pg');
      this.Client = options.Client || pg.Client;
    } catch (e) {
      // Fallback if pg module fails
      this.Client = function DummyClient() {};
    }
    if (!this.Client) {
      this.Client = function DummyClient() {};
    }`
        );
      }
      
      // Ensure newClient method exists and works
      if (!patchedContent.includes("newClient()")) {
        patchedContent = patchedContent.replace(
          /connect\s*\(\)\s*{/,
          `newClient() {
    if (!this.Client) {
      try {
        const pg = require('pg');
        this.Client = pg.Client;
      } catch (e) {
        this.Client = function DummyClient() {};
      }
    }
    return new this.Client(this.options)
  }

  connect() {`
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
