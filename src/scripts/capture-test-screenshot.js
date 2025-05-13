/**
 * Screenshot Capture Test
 * 
 * This script tests that we can properly capture PNG screenshots using Playwright.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure screenshots directory exists
const baseDir = path.join(__dirname, '..', 'api', 'browser-use', 'screenshots');
const testUserId = 'test-user-' + Date.now();
const userDir = path.join(baseDir, testUserId);

// Create directories if they don't exist
if (!fs.existsSync(baseDir)) {
  console.log(`Creating base screenshots directory: ${baseDir}`);
  fs.mkdirSync(baseDir, { recursive: true });
}

if (!fs.existsSync(userDir)) {
  console.log(`Creating user screenshot directory: ${userDir}`);
  fs.mkdirSync(userDir, { recursive: true });
}

async function captureTestScreenshot() {
  console.log('Launching browser for screenshot test...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to Google...');
    await page.goto('https://www.google.com');
    
    // Capture screenshot
    const screenshotPath = path.join(userDir, `test-screenshot-${Date.now()}.png`);
    console.log(`Capturing screenshot to: ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log(`✅ Screenshot captured successfully: ${screenshotPath}`);
    
    // Verify the file exists and is a PNG
    const fileStats = fs.statSync(screenshotPath);
    const fileExtension = path.extname(screenshotPath);
    
    console.log(`File size: ${fileStats.size} bytes`);
    console.log(`File extension: ${fileExtension}`);
    
    // Read the first few bytes to check if it's a PNG file
    const fileBuffer = fs.readFileSync(screenshotPath);
    const isPNG = fileBuffer.length > 8 && 
                  fileBuffer[0] === 0x89 && 
                  fileBuffer[1] === 0x50 && 
                  fileBuffer[2] === 0x4E && 
                  fileBuffer[3] === 0x47;
    
    console.log(`File header check - Is PNG: ${isPNG}`);
    
    if (isPNG && fileExtension === '.png' && fileStats.size > 1000) {
      console.log('✅ Verification passed: This is a valid PNG file');
    } else {
      console.error('❌ Verification failed: This is not a valid PNG file');
    }
    
    // List all files in the directory to confirm
    console.log('\nDirectory contents:');
    const files = fs.readdirSync(userDir);
    files.forEach(file => {
      const filePath = path.join(userDir, file);
      const stats = fs.statSync(filePath);
      console.log(`- ${file} (${stats.size} bytes, ${stats.isDirectory() ? 'directory' : 'file'})`);
    });
    
  } catch (error) {
    console.error('Error capturing screenshot:', error);
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

// Run the test
captureTestScreenshot().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}).finally(() => {
  console.log('Test completed');
});