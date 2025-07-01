// Provides a mock implementation of pg-native
"use strict";

console.log("Loading pg-native mock implementation");

// Create a mock Client similar to the native one
function Client() {
  this.connected = false;
}

// Connect method (supports both callback and promise styles)
Client.prototype.connect = function(connStr, callback) {
  this.connected = true;
  this.connectionString = connStr;
  
  if (callback) {
    process.nextTick(() => {
      callback(null);
    });
    return this;
  }
  
  return Promise.resolve(this);
};

// Query method (supports both callback and promise styles)
Client.prototype.query = function(text, values, callback) {
  // Handle different argument patterns
  if (typeof values === 'function') {
    callback = values;
    values = undefined;
  }
  
  const result = { rows: [], rowCount: 0 };
  
  if (callback) {
    process.nextTick(() => {
      callback(null, result);
    });
    return this;
  }
  
  return Promise.resolve(result);
};

// End method (supports both callback and promise styles)
Client.prototype.end = function(callback) {
  this.connected = false;
  
  if (callback) {
    process.nextTick(() => {
      callback(null);
    });
    return this;
  }
  
  return Promise.resolve();
};

// Provide the escape method to mimic real behavior
Client.prototype.escapeLiteral = function(str) {
  return "'" + str.replace(/'/g, "''") + "'";
};

Client.prototype.escapeIdentifier = function(str) {
  return '"' + str.replace(/"/g, '""') + '"';
};

module.exports = Client;
console.log("pg-native mock loaded successfully");