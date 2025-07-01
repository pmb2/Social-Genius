/**
 * This is a fixed version of the Pool class constructor for pg-pool
 * It properly calls super() to initialize the EventEmitter parent class
 */

'use strict'
const EventEmitter = require('events').EventEmitter

// Fix the Pool class to properly extend EventEmitter
class Pool extends EventEmitter {
  constructor(options, Client) {
    super() // Properly call the parent constructor
    
    this.options = Object.assign({}, options)

    if (options != null && 'password' in options) {
      Object.defineProperty(this.options, 'password', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: options.password,
      })
    }
    
    if (options != null && options.ssl && options.ssl.key) {
      Object.defineProperty(this.options.ssl, 'key', {
        enumerable: false,
      })
    }

    this.options.max = this.options.max || this.options.poolSize || 10
    this.options.maxUses = this.options.maxUses || Infinity
    this.options.allowExitOnIdle = this.options.allowExitOnIdle || false
    this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0
    this.log = this.options.log || function () {}
    this.Client = this.options.Client || Client || require('pg').Client
    this.Promise = this.options.Promise || global.Promise

    if (typeof this.options.idleTimeoutMillis === 'undefined') {
      this.options.idleTimeoutMillis = 10000
    }

    this._clients = []
    this._idle = []
    this._expired = new Set()
    this._pendingQueue = []
    this._endCallback = undefined
    this.ending = false
    this.ended = false
  }
}

// Export the fixed Pool class
module.exports = Pool;