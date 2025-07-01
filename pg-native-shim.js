/**
 * PG-Native Shim
 * This is a simple JavaScript-only implementation of the pg-native module
 * that just delegates to the pure JavaScript Client implementation.
 */

// Import the JavaScript client from pg
const pg = require('pg');

// Export a Client constructor that just uses the JavaScript implementation
exports.Client = pg.Client;