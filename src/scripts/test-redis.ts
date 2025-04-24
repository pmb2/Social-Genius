/**
 * Redis Test Script
 * 
 * This script tests the Redis connection and integration with the browser login manager.
 * Run with: npx ts-node src/scripts/test-redis.ts
 */

import RedisService from '../services/database/redis-service';
import RedisSessionManager from '../services/compliance/redis-session-manager';
import BrowserLoginManager from '../services/compliance/browser-login-manager';
import { createError, ErrorCodes } from '../lib/error-types';

// Set required environment variables if not already set
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.REDIS_PREFIX = process.env.REDIS_PREFIX || 'social-genius:test:';

// Test Redis connection and basic operations
async function testRedisConnection() {
  console.log('Testing Redis connection...');
  
  try {
    // Basic ping test
    const pong = await RedisService.getClient().ping();
    console.log(`Ping response: ${pong}`);
    
    // Test setting and getting a key
    const testKey = `${RedisService.getKeyPrefixes().CACHE}test`;
    await RedisService.set(testKey, 'Redis is working!', 60);
    const testValue = await RedisService.get(testKey);
    console.log(`Retrieved test key value: ${testValue}`);
    
    // Test JSON operations
    const testJsonKey = `${RedisService.getKeyPrefixes().CACHE}test-json`;
    const testObject = {
      id: 123,
      name: 'Test Object',
      timestamp: new Date().toISOString()
    };
    
    await RedisService.setJSON(testJsonKey, testObject, 60);
    const retrievedObject = await RedisService.getJSON(testJsonKey);
    console.log('Retrieved JSON object:', retrievedObject);
    
    // Test object equality
    const areEqual = JSON.stringify(testObject) === JSON.stringify(retrievedObject);
    console.log(`JSON objects are ${areEqual ? 'identical' : 'different'}`);
    
    // Test lock mechanism
    const lockName = 'test-lock';
    const lockToken = await RedisService.acquireLock(lockName, 5000);
    console.log(`Lock acquired with token: ${lockToken}`);
    
    const anotherLockAttempt = await RedisService.acquireLock(lockName, 5000);
    console.log(`Second lock attempt result: ${anotherLockAttempt}`);
    
    const releaseResult = await RedisService.releaseLock(lockName, lockToken);
    console.log(`Lock released: ${releaseResult}`);
    
    // Get Redis health status
    const healthStatus = await RedisService.getHealthStatus();
    console.log('Redis health status:', healthStatus);
    
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}

// Test Redis session manager
async function testRedisSessionManager() {
  console.log('\nTesting Redis session manager...');
  
  try {
    // Create a test session
    const session = await RedisSessionManager.createSession({
      businessId: 'test-business',
      email: 'test@example.com',
      status: 'active',
      userAgent: 'Test Browser/1.0',
      cookiesJson: JSON.stringify([{ name: 'test-cookie', value: 'test-value', domain: '.example.com' }]),
      metadata: {
        testRun: true,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('Created test session:', session.id);
    
    // Get the session
    const retrievedSession = await RedisSessionManager.getSession(session.id);
    console.log('Retrieved session:', retrievedSession?.id);
    
    // Get by business ID
    const businessSessions = await RedisSessionManager.getSessionsByBusiness('test-business');
    console.log(`Found ${businessSessions.length} sessions for test business`);
    
    // Update the session
    const updatedSession = await RedisSessionManager.updateSession(session.id, {
      metadata: {
        testRun: true,
        updated: true,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('Updated session metadata:', updatedSession?.metadata);
    
    // Delete the session
    const deleteResult = await RedisSessionManager.deleteSession(session.id);
    console.log(`Session deleted: ${deleteResult}`);
    
    return true;
  } catch (error) {
    console.error('Redis session manager test failed:', error);
    return false;
  }
}

// Test error handling with custom error types
async function testErrorHandling() {
  console.log('\nTesting error handling integration...');
  
  try {
    // Create a custom error
    const customError = createError(
      ErrorCodes.SESSION_NOT_FOUND,
      'Test session was not found',
      {
        traceId: 'test-trace-id',
        businessId: 'test-business-id',
        recoverySuggestion: 'Try creating a new session'
      }
    );
    
    console.log('Custom error created:', customError.toJSON());
    
    // Test error object serialization
    const errorKey = `${RedisService.getKeyPrefixes().CACHE}test-error`;
    await RedisService.setJSON(errorKey, customError.toJSON(), 60);
    
    const retrievedError = await RedisService.getJSON(errorKey);
    console.log('Retrieved error from Redis:', retrievedError);
    
    // Show user-friendly message
    console.log('User friendly message:', customError.toUserMessage());
    
    return true;
  } catch (error) {
    console.error('Error handling test failed:', error);
    return false;
  }
}

// Test browser login manager with Redis integration
async function testBrowserLoginManager() {
  console.log('\nTesting Browser Login Manager integration...');
  
  try {
    // Since we can't actually run a browser login test without a UI,
    // we'll just test the login manager's session methods
    
    // Check session for non-existent business
    const sessionStatus = await BrowserLoginManager.checkSession('test-business-id');
    console.log('Session status for non-existent business:', sessionStatus);
    
    // Get debug info
    const debugInfo = await BrowserLoginManager.getDebugInfo();
    console.log('Browser Login Manager debug info:', JSON.stringify(debugInfo, null, 2));
    
    return true;
  } catch (error) {
    console.error('Browser Login Manager test failed:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('Running Redis integration tests...\n');
  
  const testResults = {
    redisConnection: await testRedisConnection(),
    redisSessionManager: await testRedisSessionManager(),
    errorHandling: await testErrorHandling(),
    browserLoginManager: await testBrowserLoginManager(),
  };
  
  console.log('\nTest Results:');
  for (const [test, result] of Object.entries(testResults)) {
    console.log(`${test}: ${result ? '✅ PASSED' : '❌ FAILED'}`);
  }
  
  // Clean up
  await RedisService.shutdown();
  
  // Overall success
  const allPassed = Object.values(testResults).every(result => result);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});