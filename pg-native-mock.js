'use strict';

/**
 * pg-native mock module
 * This is a mock implementation of pg-native that can be used to replace the native module
 * when it's not available or causing issues in the environment.
 */

class MockNative {
  constructor(options) {
    this.options = options || {};
    this._listeners = {};
    this._connected = false;
  }

  // Mock the connect method
  connect(connectionString, callback) {
    process.nextTick(() => {
      this._connected = true;
      callback(null);
    });
  }

  // Mock query method
  query(text, values, callback) {
    // Handle different call patterns
    if (typeof values === 'function') {
      callback = values;
      values = undefined;
    }

    // Create a mock result
    const result = { 
      rows: [], 
      rowCount: 0,
      command: text.trim().split(' ')[0].toUpperCase(),
      oid: 0,
      fields: []
    };

    process.nextTick(() => {
      callback(null, result);
    });
  }

  // Add event listener
  on(event, listener) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(listener);
    return this;
  }

  // Remove event listener
  removeListener(event, listener) {
    if (this._listeners[event]) {
      const idx = this._listeners[event].indexOf(listener);
      if (idx !== -1) {
        this._listeners[event].splice(idx, 1);
      }
    }
    return this;
  }

  // Emit event to listeners
  emit(event, ...args) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(listener => {
        listener(...args);
      });
    }
  }

  // End connection
  end(callback) {
    process.nextTick(() => {
      this._connected = false;
      if (callback) callback();
    });
  }

  // Cancel query
  cancel(callback) {
    process.nextTick(() => {
      if (callback) callback();
    });
  }
}

module.exports = MockNative;