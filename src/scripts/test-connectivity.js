/**
 * Container Connectivity Test Script
 * 
 * Tests connectivity between Docker containers and services.
 * Run this script with Node.js inside the app container to verify
 * that all services are reachable.
 */

const http = require('http');
const Redis = require('ioredis');
const { Client } = require('pg');

// Configuration
const BROWSER_API_URL = process.env.BROWSER_USE_API_URL || 'http://browser-use-api:5055';
const REDIS_URL = process.env.REDIS_URL || 'redis://host.docker.internal:6380';  // Use host.docker.internal by default
const PG_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/socialgenius';

// Alternative Redis URLs to try if the main one fails
const ALTERNATIVE_REDIS_URLS = [
  'redis://host.docker.internal:6380',
  'redis://redis:6379',
  'redis://localhost:6380',
  'redis://127.0.0.1:6380',
  'redis://localhost:6379'
];

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

// Test Redis connectivity with fallback URLs
async function testRedisConnectivity() {
  log(`Testing connectivity to Redis at ${REDIS_URL.replace(/\/\/.*@/, '//***:***@')}`, colors.cyan);
  
  // Try each Redis URL in sequence until one works
  let result = null;
  let workingUrl = null;
  let allErrors = [];
  
  // First try the main Redis URL
  result = await tryRedisConnection(REDIS_URL);
  
  if (result.success) {
    workingUrl = REDIS_URL;
    log(`✅ Primary Redis URL works: ${REDIS_URL.replace(/\/\/.*@/, '//***:***@')}`, colors.green);
  } else {
    allErrors.push({ url: REDIS_URL, error: result.error });
    log(`❌ Primary Redis URL failed. Trying alternatives...`, colors.yellow);
    
    // Try each alternative URL
    for (const url of ALTERNATIVE_REDIS_URLS) {
      // Skip the primary URL if it's in the alternatives
      if (url === REDIS_URL) continue;
      
      log(`Trying Redis URL: ${url.replace(/\/\/.*@/, '//***:***@')}`, colors.cyan);
      result = await tryRedisConnection(url);
      
      if (result.success) {
        workingUrl = url;
        log(`✅ Found working alternative Redis URL: ${url.replace(/\/\/.*@/, '//***:***@')}`, colors.green);
        break;
      } else {
        allErrors.push({ url: url, error: result.error });
      }
    }
  }
  
  // Summarize Redis connection results
  if (workingUrl) {
    if (workingUrl !== REDIS_URL) {
      log(`⚠️ Primary Redis URL failed but found working alternative: ${workingUrl.replace(/\/\/.*@/, '//***:***@')}`, colors.yellow);
      log(`Consider updating your configuration to use this URL`, colors.yellow);
    }
    return {
      success: true,
      workingUrl,
      duration: result.duration,
      readWriteTest: result.readWriteTest
    };
  } else {
    log(`❌ All Redis URLs failed`, colors.red);
    return {
      success: false,
      errors: allErrors,
      message: "All Redis connection attempts failed"
    };
  }
}

// Helper to try connecting to a single Redis URL
async function tryRedisConnection(url) {
  return new Promise((resolve) => {
    try {
      const startTime = Date.now();
      const redis = new Redis(url, {
        connectTimeout: 5000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // Don't retry
      });
      
      // Set timeout to avoid hanging
      const timeout = setTimeout(() => {
        try {
          redis.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        
        resolve({
          success: false,
          duration: Date.now() - startTime,
          error: 'Connection timeout after 5 seconds'
        });
      }, 5000);
      
      redis.on('connect', async () => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        log(`✅ Successfully connected to Redis at ${url.replace(/\/\/.*@/, '//***:***@')} (${duration}ms)`, colors.green);
        
        try {
          // Test writing and reading a value
          const testKey = `test-connectivity-${Date.now()}`;
          const testValue = `test-value-${Date.now()}`;
          
          await redis.set(testKey, testValue, 'EX', 60); // Expire in 60 seconds
          const readValue = await redis.get(testKey);
          
          if (readValue === testValue) {
            log(`✅ Successfully wrote and read test value from Redis at ${url.replace(/\/\/.*@/, '//***:***@')}`, colors.green);
            resolve({
              success: true,
              duration,
              readWriteTest: true,
              url
            });
          } else {
            log(`❌ Read value doesn't match written value: ${readValue} !== ${testValue}`, colors.red);
            resolve({
              success: true,
              duration,
              readWriteTest: false,
              error: 'Read/write test failed',
              url
            });
          }
        } catch (ioError) {
          log(`❌ Redis I/O operation failed at ${url.replace(/\/\/.*@/, '//***:***@')}: ${ioError.message}`, colors.red);
          resolve({
            success: true,
            duration,
            readWriteTest: false,
            error: ioError.message,
            url
          });
        } finally {
          try {
            redis.quit();
          } catch (e) {
            // Ignore quit errors
          }
        }
      });
      
      redis.on('error', (err) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        log(`❌ Failed to connect to Redis at ${url.replace(/\/\/.*@/, '//***:***@')}: ${err.message} (${duration}ms)`, colors.red);
        
        try {
          redis.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        
        resolve({
          success: false,
          duration,
          error: err.message,
          url
        });
      });
    } catch (error) {
      log(`❌ Exception testing Redis connectivity at ${url.replace(/\/\/.*@/, '//***:***@')}: ${error.message}`, colors.red);
      resolve({
        success: false,
        error: error.message,
        url
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
    
    // Add additional diagnostics if we have a working Redis URL that's different from the environment
    if (results.redis.success && results.redis.workingUrl && results.redis.workingUrl !== REDIS_URL) {
      log(`\n=====================================`, colors.yellow);
      log(`IMPORTANT: Working Redis URL found: ${results.redis.workingUrl}`, colors.yellow);
      log(`Current REDIS_URL: ${REDIS_URL}`, colors.yellow);
      log(`\nRecommended action:`, colors.yellow);
      log(`1. Update docker-compose.yml to use this Redis URL for all services:`, colors.yellow);
      log(`   REDIS_URL: ${results.redis.workingUrl}`, colors.yellow);
      log(`\n2. Update docker-compose.dev.yml with the same URL`, colors.yellow);
      log(`3. Restart services: docker-compose down && docker-compose up -d`, colors.yellow);
      log(`=====================================\n`, colors.yellow);
    }
    
    // Debug environment variables
    log(`\nEnvironment variables:`, colors.cyan);
    log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`, colors.cyan);
    log(`REDIS_URL: ${process.env.REDIS_URL || 'not set'}`, colors.cyan);
    log(`BROWSER_USE_API_URL: ${process.env.BROWSER_USE_API_URL || 'not set'}`, colors.cyan);
    log(`RUNNING_IN_DOCKER: ${process.env.RUNNING_IN_DOCKER || 'not set'}`, colors.cyan);
  })
  .catch(error => {
    log(`Error running tests: ${error.message}`, colors.red);
    process.exit(1);
  });