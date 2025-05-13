/**
 * Redis Test Script
 * 
 * This script tests the Redis connection to ensure Redis is properly configured.
 * Run with: node src/scripts/test-redis.js
 */

import Redis from 'ioredis';

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://host.docker.internal:6380';
const REDIS_PREFIX = process.env.REDIS_PREFIX || 'social-genius:test:';
const TEST_KEY = `${REDIS_PREFIX}test-key`;
const TEST_SET = `${REDIS_PREFIX}test-set`;
const TEST_HASH = `${REDIS_PREFIX}test-hash`;

// Create Redis client
const redis = new Redis(REDIS_URL, {
  retryStrategy: (times) => {
    // Exponential backoff with max 30s
    const delay = Math.min(times * 100, 30000);
    console.log(`Connection attempt ${times}, retrying in ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  showFriendlyErrorStack: true,
  connectTimeout: 10000,
});

// Setup event handlers
redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('ready', () => {
  console.log('Redis connection ready');
  runTests();
});

// Test basic Redis functionality
async function runTests() {
  try {
    console.log('\n==== REDIS CONNECTION TEST ====\n');
    
    // Test 1: Ping
    console.log('Test 1: Ping...');
    const pingResponse = await redis.ping();
    console.log(`Ping response: ${pingResponse}`);
    
    // Test 2: Set and Get
    console.log('\nTest 2: Set and Get...');
    await redis.set(TEST_KEY, 'Redis is working!');
    const value = await redis.get(TEST_KEY);
    console.log(`Retrieved value: ${value}`);
    
    // Test 3: Expiry
    console.log('\nTest 3: Expiry...');
    await redis.set(`${TEST_KEY}-expiry`, 'This will expire', 'EX', 5);
    console.log('Set key with 5 second expiry');
    const value2 = await redis.get(`${TEST_KEY}-expiry`);
    console.log(`Value before expiry: ${value2}`);
    console.log('Waiting 6 seconds for expiry...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    const value3 = await redis.get(`${TEST_KEY}-expiry`);
    console.log(`Value after expiry: ${value3 === null ? 'null (expired)' : value3}`);
    
    // Test 4: Sets
    console.log('\nTest 4: Sets...');
    await redis.sadd(TEST_SET, 'item1', 'item2', 'item3');
    const setMembers = await redis.smembers(TEST_SET);
    console.log(`Set members: ${setMembers.join(', ')}`);
    
    // Test 5: Hashes
    console.log('\nTest 5: Hashes...');
    await redis.hset(TEST_HASH, 'field1', 'value1', 'field2', 'value2');
    const hashFields = await redis.hgetall(TEST_HASH);
    console.log('Hash fields:', hashFields);
    
    // Test 6: Increment
    console.log('\nTest 6: Increment...');
    await redis.set(`${TEST_KEY}-counter`, 0);
    const inc1 = await redis.incr(`${TEST_KEY}-counter`);
    console.log(`Counter after first increment: ${inc1}`);
    const inc2 = await redis.incrby(`${TEST_KEY}-counter`, 5);
    console.log(`Counter after increasing by 5: ${inc2}`);
    
    // Test 7: Transactions
    console.log('\nTest 7: Transactions...');
    const [setResult, getResult] = await redis.multi()
      .set(`${TEST_KEY}-transaction`, 'transaction-value')
      .get(`${TEST_KEY}-transaction`)
      .exec();
    
    console.log('Transaction results:');
    console.log('- Set result:', setResult[1]);
    console.log('- Get result:', getResult[1]);
    
    // Test 8: Server Info
    console.log('\nTest 8: Server Info...');
    const info = await redis.info();
    const infoLines = info.split('\r\n').slice(0, 10); // Just show first 10 lines
    console.log('Redis server info (first 10 lines):');
    infoLines.forEach(line => console.log(`  ${line}`));
    
    console.log('\n==== ALL TESTS PASSED ====');
    
    // Cleanup
    await cleanup();
    
    // Exit
    process.exit(0);
  } catch (error) {
    console.error('\n==== TEST FAILED ====');
    console.error('Error during Redis tests:', error);
    process.exit(1);
  }
}

// Clean up test keys
async function cleanup() {
  console.log('\nCleaning up test keys...');
  
  const keysToDelete = [
    TEST_KEY,
    `${TEST_KEY}-expiry`,
    `${TEST_KEY}-counter`,
    `${TEST_KEY}-transaction`,
    TEST_SET,
    TEST_HASH
  ];
  
  for (const key of keysToDelete) {
    await redis.del(key);
  }
  
  // Final cleanup and quit
  console.log('Closing Redis connection...');
  await redis.quit();
}

// Handle errors in the main process
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  redis.quit().then(() => process.exit(1));
});

// If we don't get a ready event after 10 seconds, we fail the test
setTimeout(() => {
  if (redis.status !== 'ready') {
    console.error('Failed to connect to Redis within timeout period');
    redis.quit().then(() => process.exit(1));
  }
}, 10000);