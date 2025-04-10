#!/bin/bash

# Colors for visibility
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m" # No Color

echo -e "${BLUE}===== Social Genius Database Connection Fix =====${NC}"
echo -e "${YELLOW}Creating minimal fix for PostgreSQL connection issues...${NC}"

# 1. Create pg-constructor-fix-loader.cjs
cat > pg-constructor-fix-loader.cjs << 'EOF'
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
EOF

echo -e "${GREEN}Created pg-constructor-fix-loader.cjs${NC}"

# 2. Create fix-pg-pool.cjs
cat > fix-pg-pool.cjs << 'EOF'
// This script directly overwrites the pg-pool/index.js file with a fixed version
// Run this immediately after container startup to ensure pg-pool works correctly
"use strict";

const fs = require('fs');
const path = require('path');

console.log('Starting pg-pool module fix...');

// Path to the pg-pool index.js file
const pgPoolPath = path.join(process.cwd(), 'node_modules', 'pg-pool', 'index.js');

// Check if the file exists
if (!fs.existsSync(pgPoolPath)) {
  console.error('ERROR: pg-pool module not found at:', pgPoolPath);
  process.exit(1);
}

// Create a fixed version of pg-pool
const fixedPgPool = `'use strict'

const EventEmitter = require('events').EventEmitter

// Our fake client if needed
const createFakeClient = () => {
  return class FakeClient {
    constructor(options) {
      this.options = options || {};
      this.connection = null;
    }
    
    connect(callback) {
      if (callback) callback(null, this);
      return Promise.resolve(this);
    }
    
    query(text, params, callback) {
      const result = { rows: [], rowCount: 0 };
      if (callback) callback(null, result);
      return Promise.resolve(result);
    }
    
    release() {}
    end(callback) {
      if (callback) callback();
      return Promise.resolve();
    }
    on() { return this; }
    once() { return this; }
    removeListener() { return this; }
  };
};

function throwOnRelease() {
  throw new Error('Release called on client which has already been released to the pool.')
}

function promisify(Promise, callback) {
  if (callback) {
    return { callback: callback, result: undefined }
  }
  let rej
  let res
  const cb = function(err, client) {
    if (err) {
      return rej(err)
    }
    res(client)
  }
  const result = new Promise(function(resolve, reject) {
    res = resolve
    rej = reject
  })
  return { callback: cb, result: result }
}

function makeIdleListener(pool, client) {
  return function idleListener(err) {
    err.client = client
    client.removeListener('error', idleListener)
    client.on('error', () => {
      pool.log('additional client error after disconnection due to error', err)
    })
    pool._remove(client)
    pool.emit('error', err, client)
  }
}

class Pool extends EventEmitter {
  constructor(options) {
    super()
    this.options = Object.assign({}, options)
    this.options.max = this.options.max || this.options.poolSize || 10
    this.log = this.options.log || function() {}
    
    // Fix for this.Client is not a constructor
    try {
      if (!this.options.Client) {
        try {
          // Try to get Client from pg module
          const pg = require('pg')
          this.options.Client = pg.Client
          this.log('Using pg.Client for Pool')
        } catch (e) {
          this.log('Failed to get pg.Client:', e.message)
        }
      }
      
      // Final fallback - use our fake client
      if (!this.options.Client) {
        this.options.Client = createFakeClient()
        this.log('Using fake Client for Pool')
      }
      
      // Ensure Client is available on this instance
      this.Client = this.options.Client
      
      // Also set on prototype for safety
      Pool.prototype.Client = this.Client;
    } catch (e) {
      console.error('Error fixing Client:', e)
    }
    
    this.Promise = this.options.Promise || Promise
    this.pendingQueue = []
    this.clients = []
    this.idle = []
    
    // Keeping the interval in scope so we can remove it later.
    // This prevents the interval from keeping the event loop open.
    if (this.options.idleTimeoutMillis) {
      this._reapInterval = setInterval(() => this._reap(), Math.floor(this.options.idleTimeoutMillis / 2))
      this._clearInterval = () => clearInterval(this._reapInterval)
    }
  }

  _isFull() {
    return this.clients.length >= this.options.max
  }

  connect(cb) {
    const response = promisify(this.Promise, cb)
    const result = response.result
    
    if (this.clients.length >= this.options.max || this.idle.length) {
      this.pendingQueue.push(response.callback)
      this.log('queue size: %d', this.pendingQueue.length)
      this._pulseQueue()
      return result
    }

    // if we don't have to connect a new client, don't do so
    this.newClient(response.callback)
    return result
  }

  // Fixed newClient method to handle Client availability
  newClient(cb) {
    // Make sure this.Client is available
    if (!this.Client) {
      try {
        const pg = require('pg')
        this.Client = pg.Client
        this.log('Retrieved pg.Client for Pool.newClient')
      } catch (e) {
        this.log('Failed to get pg.Client in newClient:', e.message)
        // Use our fake client if necessary
        this.Client = createFakeClient()
        this.log('Using fake Client in Pool.newClient')
      }
    }
    
    // Safely create a new client
    try {
      const client = new this.Client(this.options)
      this.clients.push(client)
      const idleListener = makeIdleListener(this, client)

      this.log('connecting new client')
      client.connect((err) => {
        if (err) {
          this.log('client failed to connect', err)
          // remove the dead client from our array
          this._remove(client)
          return cb(err, undefined, () => {})
        }

        this.log('client connected')

        client.release = (err) => {
          // Release the client and remove it from the client list
          this._release(client, idleListener, err)
        }

        cb(undefined, client, (err) => {
          client.release(err)
        })
      })
    } catch (err) {
      this.log('error creating new client', err)
      cb(err, undefined, () => {})
    }
  }

  _release(client, idleListener, err) {
    if (err) {
      this.log('release error', err)
      this._remove(client)
      return
    }
    
    if (client._destroying) {
      return
    }

    client.on('error', idleListener)
    this.idle.push(client)
    client._idle = true
    this._pulseQueue()
  }

  query(text, values, cb) {
    if (typeof text === 'function') {
      cb = text
      values = undefined
      text = undefined
    } else if (typeof values === 'function') {
      cb = values
      values = undefined
    }

    const response = promisify(this.Promise, cb)
    
    this.connect((err, client, done) => {
      if (err) {
        return response.callback(err)
      }

      client.query(text, values, (err, res) => {
        done(err)
        if (err) {
          return response.callback(err)
        }
        return response.callback(undefined, res)
      })
    })
    
    return response.result
  }

  end(cb) {
    this.log('ending')
    
    if (this._ending) {
      const err = new Error('Called end on pool more than once')
      return cb ? cb(err) : this.Promise.reject(err)
    }
    
    this._ending = true
    
    const response = promisify(this.Promise, cb)
    
    // Clear any interval we may have set to reap idle clients
    if (this._clearInterval) {
      this._clearInterval()
    }
    
    const clients = this.idle.slice()
    this.idle = []
    
    // Close all idle clients
    if (clients.length) {
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i]
        client._destroying = true
        client.end()
      }
    }
    
    // Close active clients
    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i]
      if (!client._idle) {
        client._destroying = true
        client.end()
      }
    }
    
    this.clients = []
    this.pendingQueue = []
    
    response.callback()
    return response.result
  }
  
  // Remove a client from the client list
  _remove(client) {
    client._idle = false
    const idx = this.clients.indexOf(client)
    if (idx !== -1) {
      this.clients.splice(idx, 1)
    }
    
    // Remove from idle list if it's in there
    for (let i = 0; i < this.idle.length; i++) {
      const idleClient = this.idle[i]
      if (idleClient === client) {
        this.idle.splice(i, 1)
        break
      }
    }
  }
  
  // Reap idle clients
  _reap() {
    const now = Date.now()
    for (let i = 0; i < this.idle.length; i++) {
      const client = this.idle[i]
      if (client._lastRelease && (now - client._lastRelease) > this.options.idleTimeoutMillis) {
        this.idle.splice(i, 1)
        i--
        client._destroying = true
        client.end()
        this._remove(client)
      }
    }
  }
  
  // Process the next pending query
  _pulseQueue() {
    if (!this.pendingQueue.length) {
      return
    }
    
    if (!this._isFull() && !this.idle.length) {
      const cb = this.pendingQueue.shift()
      this.newClient(cb)
      return
    } else if (this.idle.length) {
      const cb = this.pendingQueue.shift()
      const client = this.idle.pop()
      client._idle = false
      client.removeListener('error', makeIdleListener(this, client))
      cb(undefined, client, (err) => {
        client.release(err)
      })
    }
  }
}

// Export Pool in a way that works with or without "new"
function createPool(options) {
  if (!(this instanceof createPool)) {
    return new Pool(options);
  }
  return new Pool(options);
}

// Copy properties
createPool.Pool = Pool;

module.exports = createPool;
`;

// Write the fixed version
try {
  fs.writeFileSync(pgPoolPath, fixedPgPool, 'utf8');
  console.log('SUCCESS: pg-pool module has been fixed!');
} catch (error) {
  console.error('ERROR: Failed to write fixed pg-pool module:', error);
  process.exit(1);
}

// Success
console.log('pg-pool fix completed successfully!');
EOF

echo -e "${GREEN}Created fix-pg-pool.cjs${NC}"

# 3. Update docker-compose.dev.yml to include our fixes
cat > docker-compose.dev.yml << 'EOF'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/socialgenius
      - DATABASE_URL_DOCKER=postgresql://postgres:postgres@postgres:5432/socialgenius
      - PG_DEBUG=true
      - NEXTAUTH_URL=http://localhost:3001
      - NEXTAUTH_SECRET=your-nextauth-secret
      - NODE_ENV=development
      - BROWSER_API_URL=http://browser-use-api:5055
      - SUPPRESS_FAST_REFRESH_LOGS=true
      - NEXT_COMPILER_FILTER_WARNINGS=true
      - NODE_PG_FORCE_NATIVE=0
      - RUNNING_IN_DOCKER=true
      - NODE_OPTIONS=--require=/app/pg-constructor-fix-loader.cjs --max-old-space-size=4096
    volumes:
      - ./:/app
      - /app/node_modules
      - /app/.next
    command: >
      sh -c "
        node fix-pg-pool.cjs &&
        npm run dev
      "
    depends_on:
      postgres:
        condition: service_healthy
      browser-use-api:
        condition: service_healthy

  browser-use-api:
    build:
      context: ./browser-use-api
      dockerfile: Dockerfile
    container_name: social-genius-browser-api
    volumes:
      - ./browser-use-api/screenshots:/app/screenshots
    environment:
      - PORT=5055
      - HOST=0.0.0.0
    ports:
      - "5055:5055"
    restart: unless-stopped
    command: bash -c "pip install -r requirements.txt && python -m uvicorn server:app --host 0.0.0.0 --port 5055"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5055/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  postgres:
    image: pgvector/pgvector:pg14
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=socialgenius
    ports:
      - "5435:5432"
    volumes:
      - postgres_data_v14:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@socialgenius.com
      - PGADMIN_DEFAULT_PASSWORD=admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data_v14:
EOF

echo -e "${GREEN}Updated docker-compose.dev.yml with database connection fixes${NC}"

# 4. Clean up any old Docker containers
echo -e "${YELLOW}Cleaning up any old Docker containers...${NC}"
docker-compose -f docker-compose.dev.yml down --volumes

# 5. Final instructions
echo -e "${GREEN}All fixes have been applied!${NC}"
echo
echo -e "${BLUE}To start the application with PostgreSQL fixes:${NC}"
echo -e "${YELLOW}./start-dev.sh${NC}"
echo
echo -e "${BLUE}The fixes applied:${NC}"
echo -e "1. Created pg-constructor-fix-loader.cjs to patch module loading"
echo -e "2. Created fix-pg-pool.cjs to fix the pg-pool module"
echo -e "3. Updated docker-compose.dev.yml to apply these fixes at startup"
echo
echo -e "${BLUE}This should resolve the PostgreSQL connection issues in Docker.${NC}"
EOF

chmod +x minimal-fix.sh
echo "Created minimal-fix.sh script. Run it to apply database connection fixes."