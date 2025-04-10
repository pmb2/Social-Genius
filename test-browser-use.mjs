/**
 * Simple browser automation test script
 * 
 * This script tests browser automation to verify the browser-use dependency
 * is successfully installed. It uses Playwright directly for the most
 * reliable results.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

// Create screenshots directory
const screenshotsDir = './screenshots/test-' + Date.now();
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

console.log(`Created screenshots directory: ${screenshotsDir}`);

async function main() {
  try {
    console.log('Initializing browser automation test...');
    
    // Import Playwright and verify browser-use
    const { chromium } = await import('playwright');
    
    // Verify browser-use is installed
    const browserUse = await import('@browser-use/browser-use-node');
    console.log('Browser-use is installed with modules:', Object.keys(browserUse).join(', '));
    
    // Launch browser with Playwright
    console.log('Launching browser with Playwright...');
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-web-security',
      ]
    });
    
    // Create a context with human-like characteristics
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      acceptDownloads: true,
    });
    
    // Create page
    const page = await context.newPage();
    console.log('Browser and page created');
    
    try {
      // Take screenshots function
      const takeScreenshot = async (name) => {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `${name}_${timestamp}.png`;
        const screenshotPath = `${screenshotsDir}/${filename}`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${screenshotPath}`);
        return screenshotPath;
      };
      
      // Add stealth scripts to make automation less detectable
      await page.addInitScript(() => {
        // Override navigator properties
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'productSub', { get: () => '20030107' });
        Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      });
      
      // Navigate to simple example.com to avoid Google's detection
      console.log('Navigating to example.com...');
      await page.goto('https://example.com');
      await takeScreenshot('example_page');
      
      // Check if we have a test success condition
      const heading = await page.locator('h1').innerText();
      console.log('Page title:', heading);
      
      console.log('Test completed successfully!');
    } finally {
      // Close browser
      await browser.close();
      console.log('Browser closed.');
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
main().catch(console.error);

console.log('Test script execution complete. Check the screenshots directory for results.');