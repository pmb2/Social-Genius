/**
 * Container Connectivity Test Script
 * 
 * Tests connectivity between Docker containers and services.
 * Run this script with Node.js inside the app container to verify
 * that all services are reachable.
 */

import http from 'http';
import { createClient } from 'redis';
import pg from 'pg';
const { Client } = pg;

// Configuration
const BROWSER_API_URL = process.env.BROWSER_USE_API_URL || 'http://browser-use-api:5055';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const PG_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/socialgenius';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Log with timestamp and color
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Test HTTP connectivity to the browser API
async function testBrowserApiConnectivity() {
  log(`Testing connectivity to Browser API at ${BROWSER_API_URL}`, colors.cyan);
  
  return new Promise((resolve) => {
    try {
      const healthUrl = `${BROWSER_API_URL}/health`;
      log(`Sending request to ${healthUrl}`, colors.blue);
      
      const startTime = Date.now();
      
      http.get(healthUrl, (res) => {
        const duration = Date.now() - startTime;
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            log(`✅ Successfully connected to Browser API (${duration}ms)`, colors.green);
            log(`Response: ${data}`, colors.green);
            resolve({
              success: true,
              duration,
              statusCode: res.statusCode,
              response: data
            });
          } else {
            log(`❌ Failed to connect to Browser API: Status ${res.statusCode} (${duration}ms)`, colors.red);
            resolve({
              success: false,
              duration,
              statusCode: res.statusCode,
              error: `HTTP error: ${res.statusCode}`
            });
          }
        });
      }).on('error', (err) => {
        const duration = Date.now() - startTime;
        log(`❌ Failed to connect to Browser API: ${err.message} (${duration}ms)`, colors.red);
        resolve({
          success: false,
          duration,
          error: err.message
        });
      });
    } catch (error) {
      log(`❌ Exception testing Browser API connectivity: ${error.message}`, colors.red);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}

// Test Redis connectivity
async function testRedisConnectivity() {
  log(`Testing connectivity to Redis at ${REDIS_URL.replace(/\/\/.*@/, '//***:***@')}`, colors.cyan);
  
  return new Promise((resolve) => {
    try {
      const startTime = Date.now();
      
      const client = createClient({
        url: REDIS_URL,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
        }
      });
      
      client.on('connect', async () => {
        const duration = Date.now() - startTime;
        log(`✅ Successfully connected to Redis (${duration}ms)`, colors.green);
        
        try {
          // Test writing and reading a value
          const testKey = `test-connectivity-${Date.now()}`;
          const testValue = `test-value-${Date.now()}`;
          
          await client.set(testKey, testValue, { EX: 60 }); // Expire in 60 seconds
          const readValue = await client.get(testKey);
          
          if (readValue === testValue) {
            log(`✅ Successfully wrote and read test value from Redis`, colors.green);
            resolve({
              success: true,
              duration,
              readWriteTest: true
            });
          } else {
            log(`❌ Read value doesn't match written value: ${readValue} !== ${testValue}`, colors.red);
            resolve({
              success: true,
              duration,
              readWriteTest: false,
              error: 'Read/write test failed'
            });
          }
        } catch (ioError) {
          log(`❌ Redis I/O operation failed: ${ioError.message}`, colors.red);
          resolve({
            success: true,
            duration,
            readWriteTest: false,
            error: ioError.message
          });
        } finally {
          await client.quit();
        }
      });
      
      client.on('error', (err) => {
        const duration = Date.now() - startTime;
        log(`❌ Failed to connect to Redis: ${err.message} (${duration}ms)`, colors.red);
        resolve({
          success: false,
          duration,
          error: err.message
        });
        client.quit();
      });
      
      // Connect to Redis
      client.connect();
      
    } catch (error) {
      log(`❌ Exception testing Redis connectivity: ${error.message}`, colors.red);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}

// Test Postgres connectivity
async function testPostgresConnectivity() {
  log(`Testing connectivity to Postgres at ${PG_CONNECTION_STRING.replace(/\/\/.*@/, '//***:***@')}`, colors.cyan);
  
  return new Promise((resolve) => {
    try {
      const startTime = Date.now();
      const client = new Client({
        connectionString: PG_CONNECTION_STRING,
        connectionTimeoutMillis: 5000
      });
      
      client.connect()
        .then(async () => {
          const duration = Date.now() - startTime;
          log(`✅ Successfully connected to Postgres (${duration}ms)`, colors.green);
          
          try {
            // Check database version
            const res = await client.query('SELECT version()');
            log(`✅ Postgres version: ${res.rows[0].version}`, colors.green);
            
            resolve({
              success: true,
              duration,
              version: res.rows[0].version
            });
          } catch (queryError) {
            log(`❌ Postgres query failed: ${queryError.message}`, colors.red);
            resolve({
              success: true,
              duration,
              queryTest: false,
              error: queryError.message
            });
          } finally {
            client.end();
          }
        })
        .catch((err) => {
          const duration = Date.now() - startTime;
          log(`❌ Failed to connect to Postgres: ${err.message} (${duration}ms)`, colors.red);
          resolve({
            success: false,
            duration,
            error: err.message
          });
        });
    } catch (error) {
      log(`❌ Exception testing Postgres connectivity: ${error.message}`, colors.red);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}

// Main function to run all tests
async function runAllTests() {
  log('🔍 Starting container connectivity tests', colors.cyan);
  log(`Environment: ${process.env.NODE_ENV || 'not set'}`, colors.yellow);
  log(`Working directory: ${process.cwd()}`, colors.yellow);
  log(`----------------------------------`, colors.yellow);
  
  const results = {
    timestamp: new Date().toISOString(),
    browserApi: await testBrowserApiConnectivity(),
    redis: await testRedisConnectivity(),
    postgres: await testPostgresConnectivity()
  };
  
  log(`----------------------------------`, colors.yellow);
  log('📊 Test Results Summary:', colors.cyan);
  
  // Browser API results
  log(`Browser API: ${results.browserApi.success ? '✅ SUCCESS' : '❌ FAILED'}`, 
    results.browserApi.success ? colors.green : colors.red);
  
  // Redis results  
  log(`Redis: ${results.redis.success ? '✅ SUCCESS' : '❌ FAILED'}`,
    results.redis.success ? colors.green : colors.red);
  
  // Postgres results
  log(`Postgres: ${results.postgres.success ? '✅ SUCCESS' : '❌ FAILED'}`,
    results.postgres.success ? colors.green : colors.red);
  
  log(`----------------------------------`, colors.yellow);
  
  // Overall status
  const allSuccessful = results.browserApi.success && results.redis.success && results.postgres.success;
  
  if (allSuccessful) {
    log('🎉 All connectivity tests PASSED!', colors.green);
  } else {
    log('❌ Some connectivity tests FAILED!', colors.red);
    
    // Provide troubleshooting suggestions
    log(`Troubleshooting suggestions:`, colors.yellow);
    
    if (!results.browserApi.success) {
      log(`- Browser API: Check if the browser-use-api container is running and healthy`, colors.yellow);
      log(`  Command: docker-compose ps browser-use-api`, colors.yellow);
      log(`  Try: docker-compose restart browser-use-api`, colors.yellow);
    }
    
    if (!results.redis.success) {
      log(`- Redis: Check if the Redis container is running and healthy`, colors.yellow);
      log(`  Command: docker-compose ps redis`, colors.yellow);
      log(`  Try: docker-compose restart redis`, colors.yellow);
    }
    
    if (!results.postgres.success) {
      log(`- Postgres: Check if the Postgres container is running and healthy`, colors.yellow);
      log(`  Command: docker-compose ps postgres`, colors.yellow);
      log(`  Try: docker-compose restart postgres`, colors.yellow);
    }
    
    log(`- Check that all services are on the same Docker network`, colors.yellow);
    log(`  Command: docker network inspect social_genius_network`, colors.yellow);
  }
  
  return results;
}

// Run the tests
runAllTests()
  .then(results => {
    log('Tests completed!', colors.cyan);
  })
  .catch(error => {
    log(`Error running tests: ${error.message}`, colors.red);
    process.exit(1);
  });