/**
 * Test Google Authentication with Browser Use API
 * 
 * This script directly tests the browser automation service's ability
 * to authenticate with Google, bypassing the API routes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

// Set up __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import BrowserAutomationService from direct module path
import { BrowserAutomationService } from '../lib/browser-automation/index.js';

// Ensure screenshots directory exists
const baseDir = path.join(__dirname, '..', 'api', 'browser-use', 'screenshots');
const testBusinessId = 'test-business-' + Date.now();
const userDir = path.join(baseDir, testBusinessId);

// Create directories if they don't exist
if (!fs.existsSync(baseDir)) {
  console.log(`Creating base screenshots directory: ${baseDir}`);
  fs.mkdirSync(baseDir, { recursive: true });
}

if (!fs.existsSync(userDir)) {
  console.log(`Creating test business screenshot directory: ${userDir}`);
  fs.mkdirSync(userDir, { recursive: true });
}

// Get test credentials - either from command line args or environment variables
const TEST_EMAIL = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.argv[3] || process.env.TEST_PASSWORD || 'password123';
const TEST_BUSINESS_ID = testBusinessId;

/**
 * Run the test authentication process directly with BrowserAutomationService
 */
async function runTest() {
  console.log(`\n==================================================`);
  console.log(`DIRECT GOOGLE AUTHENTICATION TEST WITH SCREENSHOTS`);
  console.log(`Test Business ID: ${TEST_BUSINESS_ID}`);
  console.log(`Screenshots Directory: ${userDir}`);
  console.log(`==================================================\n`);
  
  try {
    // Get an instance of BrowserAutomationService
    const browserService = BrowserAutomationService.getInstance();
    console.log('✅ Got BrowserAutomationService instance');
    
    // Check if the service is healthy
    console.log('🩺 Checking browser service health...');
    const isHealthy = await browserService.checkHealth();
    
    if (!isHealthy) {
      console.error('❌ Browser service is NOT healthy!');
      console.error('Please check that browser-use-api container is running and accessible');
      return false;
    }
    
    console.log('✅ Browser service is healthy');
    
    // Start the authentication process
    console.log(`\n🔑 Authenticating with Google (email: ${TEST_EMAIL})...`);
    console.log(`🔑 Business ID: ${TEST_BUSINESS_ID}`);
    
    // Use the authenticateGoogle method to start authentication
    const startTime = Date.now();
    console.log(`⏱️ Authentication started at: ${new Date(startTime).toISOString()}`);
    
    const authResult = await browserService.authenticateGoogle(
      TEST_BUSINESS_ID,
      TEST_EMAIL,
      TEST_PASSWORD,
      {
        reuseSession: false, // Don't reuse existing session for testing
        persistSession: true, // Save the session for future use
        debug: true, // Enable extra debugging
        takeScreenshots: true // Capture screenshots at each step
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`⏱️ Authentication completed in ${duration}ms`);
    
    // Log the authentication result
    if (authResult.status === 'success') {
      console.log(`\n✅ AUTHENTICATION SUCCESSFUL!`);
      console.log(`Task ID: ${authResult.taskId}`);
      console.log(`Trace ID: ${authResult.traceId}`);
      console.log(`Duration: ${authResult.duration || duration}ms`);
      
      if (authResult.result) {
        console.log('Result:', JSON.stringify(authResult.result, null, 2));
      }
    } else {
      console.log(`\n❌ AUTHENTICATION FAILED!`);
      console.log(`Error: ${authResult.error || 'No error message provided'}`);
      console.log(`Task ID: ${authResult.taskId}`);
      console.log(`Trace ID: ${authResult.traceId}`);
      console.log(`Duration: ${authResult.duration || duration}ms`);
    }
    
    // List screenshots if available in the response
    if (authResult.screenshots && authResult.screenshots.length > 0) {
      console.log(`\n📸 SCREENSHOTS CAPTURED IN RESPONSE:`);
      authResult.screenshots.forEach((screenshot, index) => {
        console.log(`${index + 1}. ${screenshot}`);
      });
    }
    
    // List all screenshots in the directory
    console.log(`\n📸 SCREENSHOTS IN DIRECTORY:`);
    if (fs.existsSync(userDir)) {
      const screenshots = fs.readdirSync(userDir).filter(f => 
        f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
      );
      
      if (screenshots.length === 0) {
        console.log('No screenshots found in directory!');
      } else {
        screenshots.forEach((screenshot, index) => {
          console.log(`${index + 1}. ${screenshot}`);
        });
      }
    } else {
      console.log(`Directory ${userDir} does not exist!`);
    }
    
    // Wait a moment to allow any pending operations to complete
    console.log('Waiting for any pending operations to complete...');
    await setTimeout(2000);
    
    console.log(`\n==================================================`);
    console.log(`TEST COMPLETE - ${authResult.status === 'success' ? 'SUCCESS' : 'FAILED'}`);
    console.log(`View screenshots at: ${userDir}`);
    console.log(`Check API endpoint: /api/compliance/auth-screenshots?userId=${TEST_BUSINESS_ID}&listAll=true`);
    console.log(`==================================================\n`);
    
    return authResult.status === 'success';
  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error);
    console.log(`\n==================================================`);
    console.log(`TEST FAILED - UNEXPECTED ERROR`);
    console.log(`View screenshots at: ${userDir}`);
    console.log(`==================================================\n`);
    return false;
  }
}

// Execute the test
runTest().then(success => {
  console.log(`\nTest ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
});