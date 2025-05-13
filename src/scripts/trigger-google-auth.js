/**
 * Trigger Google Authentication via API
 * 
 * This script simulates a frontend API call to the Google Auth endpoint
 * to test authentication and screenshot capture through the API flow.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';

// Set up __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get test credentials - either from command line args or environment variables
const TEST_EMAIL = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.argv[3] || process.env.TEST_PASSWORD || 'password123';
const API_URL = process.argv[4] || process.env.API_URL || 'http://localhost:3000';
const BUSINESS_ID = process.argv[5] || `biz-${Date.now()}`;

// Test session cookie for authentication with the API
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || 'session=6f0aca81a05c27a1f639164d3aa08807c980494db2f076533f0892b302bb3e94';

// Path to store results for debugging
const resultsDir = path.join(__dirname, '..', '..', 'browser-use-api', 'logs');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function triggerAuth() {
  console.log(`\n==================================================`);
  console.log(`API-BASED GOOGLE AUTHENTICATION TEST`);
  console.log(`Business ID: ${BUSINESS_ID}`);
  console.log(`API URL: ${API_URL}/api/google-auth`);
  console.log(`==================================================\n`);
  
  try {
    // Generate a unique request ID for tracing
    const requestId = `test-auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`🔑 Sending authentication request to API...`);
    console.log(`🔑 Email: ${TEST_EMAIL}`);
    console.log(`🔑 Business ID: ${BUSINESS_ID}`);
    console.log(`🔖 Request ID: ${requestId}`);
    
    const startTime = Date.now();
    console.log(`⏱️ Request started at: ${new Date(startTime).toISOString()}`);
    
    // Send the authentication request to the API
    const authResponse = await fetch(`${API_URL}/api/google-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': TEST_SESSION_COOKIE,
        'X-Request-ID': requestId
      },
      body: JSON.stringify({
        businessId: BUSINESS_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        options: {
          reuseSession: false,
          persistSession: true,
          debug: true,
          takeScreenshots: true
        }
      })
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`⏱️ Request completed in ${duration}ms`);
    
    // Parse the response
    const authData = await authResponse.json();
    
    // Save the response to a file for debugging
    const resultFile = path.join(resultsDir, `auth-result-${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(authData, null, 2));
    console.log(`📄 Saved result to: ${resultFile}`);
    
    // Check if authentication was initiated successfully
    if (authResponse.ok && authData.success) {
      console.log(`\n✅ AUTHENTICATION TASK INITIATED SUCCESSFULLY`);
      console.log(`Task ID: ${authData.taskId}`);
      console.log(`Trace ID: ${authData.traceId}`);
      
      if (authData.screenshots && authData.screenshots.length > 0) {
        console.log(`\n📸 SCREENSHOTS CAPTURED (from initial response):`);
        authData.screenshots.forEach((screenshot, index) => {
          console.log(`${index + 1}. ${screenshot}`);
        });
      }
      
      // Poll for task completion (if task ID is provided)
      if (authData.taskId) {
        console.log(`\n⏳ Polling for task completion...`);
        
        let taskComplete = false;
        let attempts = 0;
        const maxAttempts = 20;
        
        while (!taskComplete && attempts < maxAttempts) {
          attempts++;
          console.log(`Polling attempt ${attempts}/${maxAttempts}...`);
          
          try {
            // Wait a bit before each polling attempt
            const delay = Math.min(2000 * Math.pow(1.5, attempts - 1), 20000); // Exponential backoff
            await setTimeout(delay);
            
            // Check task status
            const statusResponse = await fetch(`${API_URL}/api/google-auth?taskId=${authData.taskId}`, {
              headers: {
                'Cookie': TEST_SESSION_COOKIE,
                'X-Request-ID': `status-${requestId}-${attempts}`
              }
            });
            
            const statusData = await statusResponse.json();
            
            console.log(`Status: ${statusData.status}`);
            
            // Check if task is complete
            if (statusData.status === 'completed' || statusData.status === 'failed') {
              taskComplete = true;
              
              // Save the final status to a file
              const statusFile = path.join(resultsDir, `status-result-${Date.now()}.json`);
              fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
              console.log(`📄 Saved final status to: ${statusFile}`);
              
              // Log the final result
              if (statusData.status === 'completed') {
                console.log(`\n✅ AUTHENTICATION COMPLETED SUCCESSFULLY`);
              } else {
                console.log(`\n❌ AUTHENTICATION FAILED`);
                console.log(`Error: ${statusData.error || 'No error message provided'}`);
              }
              
              // Log screenshots if available
              if (statusData.screenshots && statusData.screenshots.length > 0) {
                console.log(`\n📸 SCREENSHOTS CAPTURED (from final status):`);
                statusData.screenshots.forEach((screenshot, index) => {
                  console.log(`${index + 1}. ${screenshot}`);
                });
              }
              
              break;
            }
          } catch (pollError) {
            console.error(`Error polling for status (attempt ${attempts}):`, pollError.message);
          }
        }
        
        if (!taskComplete) {
          console.log(`\n⚠️ Polling timed out after ${maxAttempts} attempts`);
        }
      }
      
      console.log(`\n==================================================`);
      console.log(`API TEST COMPLETE`);
      console.log(`Results saved to: ${resultsDir}`);
      console.log(`==================================================\n`);
      
      return true;
    } else {
      console.log(`\n❌ AUTHENTICATION REQUEST FAILED`);
      console.log(`Status: ${authResponse.status}`);
      console.log(`Error: ${authData.error || 'No error message provided'}`);
      
      console.log(`\n==================================================`);
      console.log(`API TEST FAILED`);
      console.log(`Results saved to: ${resultFile}`);
      console.log(`==================================================\n`);
      
      return false;
    }
  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error);
    
    console.log(`\n==================================================`);
    console.log(`API TEST FAILED WITH ERROR`);
    console.log(`==================================================\n`);
    
    return false;
  }
}

// Execute the test
triggerAuth().then(success => {
  console.log(`\nTest ${success ? 'COMPLETED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
});