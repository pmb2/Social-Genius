/**
 * Test script for feature flag service
 * 
 * This script tests both the browser and server implementations of the feature flag service.
 * Run with: npx tsx src/services/feature-flag-service/test.ts
 */

import { FeatureFlag, FeatureFlagService } from './index';

async function testFeatureFlagService() {
  console.log('Testing feature flag service...');
  
  // Test server-side implementation (should be used since we're in Node.js)
  const service = FeatureFlagService.getInstance();
  
  // Test some flags
  console.log('GoogleAuthWithOAuth enabled:', service.isEnabled(FeatureFlag.GoogleAuthWithOAuth));
  
  // Test with a user ID
  console.log('GoogleAuthWithOAuth enabled for user 123:', service.isEnabled(FeatureFlag.GoogleAuthWithOAuth, '123'));
  
  console.log('All tests completed.');
}

// Execute the test
testFeatureFlagService().catch(console.error);