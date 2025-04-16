/**
 * Browser Manager
 * 
 * Manages Playwright browser instances for automated browser interactions.
 * This is a simplified version that uses Playwright directly without additional
 * frameworks like Agno or Motia.
 */

import type { Browser, BrowserContext, Page } from 'playwright';

/**
 * Controlled logging function to reduce console spam
 * Logs only when debug mode is enabled or for errors
 */
function log(message: string, level: 'info' | 'error' | 'warn' = 'info'): void {
  // Always log errors, only log info/warn when specific debug flags are enabled
  const debugAutomation = process.env.DEBUG_AUTOMATION === 'true';
  const debugScreenshots = process.env.DEBUG_SCREENSHOTS === 'true';
  const isDev = process.env.NODE_ENV === 'development';
  
  // Determine if we should log based on level and environment
  const shouldLog = 
    level === 'error' || // Always log errors
    (level === 'warn' && isDev) || // Log warnings in development
    (debugAutomation && message.includes('automation')) || // Log automation messages if debug is enabled
    (debugScreenshots && message.includes('screenshot')); // Log screenshot messages if debug is enabled
  
  if (shouldLog) {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    const prefix = `[BROWSER ${timestamp}]`;
    
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

/**
 * Interface for browser automation functions
 */
export interface BrowserAutomation {
  navigate(url: string): Promise<void>;
  getCurrentUrl(): Promise<string>;
  getText(selector: string): Promise<string | null>;
  click(selector: string, options?: { force?: boolean, timeout?: number }): Promise<void>;
  fill(selector: string, value: string, options?: { timeout?: number }): Promise<void>;
  waitForNavigation(options?: any): Promise<void>;
  waitForSelector(selector: string, options?: any): Promise<void>;
  verifyElement(selector: string, options?: { timeout?: number }): Promise<boolean>;
  takeScreenshot(fileName?: string): Promise<string>;
  performLogin(options: LoginOptions): Promise<LoginResult>;
}

/**
 * Options for logging in to a website
 */
export interface LoginOptions {
  // Email page selectors
  emailSelector: string;
  emailNextSelector: string;
  emailErrorSelector?: string; // Optional selector to check for email errors

  // Password page selectors
  passwordSelector: string;
  passwordNextSelector: string;
  passwordErrorSelector?: string; // Optional selector to check for password errors
  
  // Two-factor auth selectors (optional)
  tfaSelector?: string;
  tfaNextSelector?: string;
  
  // Recovery options selectors (optional)
  recoveryOptionSelector?: string;
  
  // Credentials
  credentials: {
    email: string;
    password: string;
    tfaCode?: string; // Optional 2FA code
  };
  
  // Validation and success indicators
  successIndicator: string; // URL or selector to verify successful login
  
  // Verification options
  verifyEmailEntered?: boolean; // Whether to verify email was entered correctly
  verifyPasswordEntered?: boolean; // Whether to verify password entry
  captureScreenshots?: boolean; // Whether to capture screenshots at each step
  screenshotPrefix?: string; // Prefix for screenshot file names
  
  // Timeouts
  timeouts?: {
    email?: number; // Default: 10000ms
    password?: number; // Default: 10000ms
    navigation?: number; // Default: 15000ms
  };
}

/**
 * Result of a login attempt
 */
export interface LoginResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
  
  // Additional details
  steps?: Array<{
    step: string;
    status: 'success' | 'failed' | 'skipped' | 'pending';
    timestamp: number;
    error?: string;
    screenshot?: string; // Path to screenshot if taken
  }>;
  
  // Final state
  currentUrl?: string;
  state?: 'logged_in' | 'email_error' | 'password_error' | 'tfa_required' | 'recovery_required' | 'captcha_detected' | 'unknown';
  
  // Debug information
  debugInfo?: {
    duration: number;
    timestamps: Record<string, number>;
    browserInfo?: string;
    screenshots?: string[];
  };
}

/**
 * Type for browser instance storage
 */
interface BrowserInstance {
  browser: Browser;        // Playwright browser instance
  context: BrowserContext; // Playwright browser context
  page: Page;              // Playwright page
  automation: BrowserAutomation; // Browser automation functions
  lastUsed: Date;          // Timestamp of last activity
  active: boolean;         // Whether the instance is currently active
}

/**
 * Browser automation implementation using Playwright directly
 */
class PlaywrightAutomation implements BrowserAutomation {
  private page: Page;
  private screenshotsDir: string = process.env.SCREENSHOTS_DIR || './screenshots';
  
  constructor(page: Page) {
    this.page = page;
    this.initializeHumanBehavior();
  }
  
  /**
   * Initialize human-like behavior for the browser
   */
  private async initializeHumanBehavior(): Promise<void> {
    try {
      // Add extra HTTP headers that real browsers typically send with user-agent included
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
      ];
      
      // Choose a random user agent
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      
      await this.page.setExtraHTTPHeaders({
        'User-Agent': randomUserAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      });
      
      // Randomize viewport size slightly to appear more human-like
      const width = 1280 + Math.floor(Math.random() * 200) - 100; // 1180-1380
      const height = 720 + Math.floor(Math.random() * 150) - 75; // 645-795
      
      await this.page.setViewportSize({ 
        width,
        height
      });
      
      // Add timezone and platform features to appear more like a real browser
      await this.page.addInitScript(() => {
        try {
          // Override certain JavaScript variables that detection systems check
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
          
          // Add fake plugins
          try {
            Object.defineProperty(navigator, 'plugins', { 
              get: () => [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client' }
              ]
            });
          } catch (pluginError) {
            // Ignore if plugins can't be set
          }
          
          // Set the user agent directly in JavaScript as well
          try {
            Object.defineProperty(navigator, 'userAgent', { 
              get: function() { 
                return window.navigator.userAgent;
              }
            });
          } catch (uaError) {
            // Ignore if userAgent can't be overridden
          }
          
          // Add some randomness to fingerprinting protection
          try {
            const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            Date.prototype.getTimezoneOffset = function() {
              const result = originalGetTimezoneOffset.call(this);
              return result + (Math.random() < 0.01 ? 1 : 0); // Very occasionally add 1 minute to create noise
            };
          } catch (timeError) {
            // Ignore if timezone can't be modified
          }
        } catch (scriptError) {
          // Ignore any errors in the script
          console.log('Script error:', scriptError);
        }
      });
    } catch (error) {
      console.warn('Error setting up human behavior:', error);
      // Non-critical error, continue without human behavior
    }
  }
  
  /**
   * Generate a timestamped filename for screenshots
   */
  private getTimestampedFilename(prefix: string = 'screenshot'): string {
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '_');
    return `${prefix}_${timestamp}.png`;
  }
  
  /**
   * Generate a full path for a screenshot
   */
  private async getScreenshotPath(filename: string): Promise<string> {
    // Create screenshots directory if it doesn't exist
    try {
      // Use dynamic import instead of require
      const fs = await import('fs');
      if (!fs.existsSync(this.screenshotsDir)) {
        fs.mkdirSync(this.screenshotsDir, { recursive: true });
        console.log(`Created screenshots directory: ${this.screenshotsDir}`);
      }
    } catch (error) {
      console.warn(`Failed to ensure screenshots directory exists: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Limit filename length to avoid ENAMETOOLONG errors
    // Most filesystems have a maximum path length of 255 characters
    const maxFilenameLength = 180; // Leave room for directory path
    let safeFilename = filename;
    if (filename.length > maxFilenameLength) {
      // Keep the beginning and end, trim the middle
      const extension = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
      const nameWithoutExt = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
      const halfLength = Math.floor((maxFilenameLength - extension.length - 3) / 2); // -3 for '...' in the middle
      safeFilename = nameWithoutExt.substring(0, halfLength) + '...' + 
                   nameWithoutExt.substring(nameWithoutExt.length - halfLength) + extension;
    }
    
    return `${this.screenshotsDir}/${safeFilename}`;
  }
  
  /**
   * Navigate to a URL with human-like behavior while evading browser security checks
   */
  public async navigate(url: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Navigating to: ${url}`);
    }
    
    try {
      // Setup page to evade browser security detection
      await this.setupEvasionMeasures();
      
      // Capture a screenshot before navigation
      await this.takeScreenshot('before_navigation');
      
      // First, attempt to navigate with custom headers
      // Add custom headers that look like regular browsers
      const customHeaders = {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      };
      
      try {
        await this.page.setExtraHTTPHeaders(customHeaders);
      } catch (headerError) {
        log(`Warning: Could not set custom headers: ${headerError instanceof Error ? headerError.message : String(headerError)}`, 'warn');
      }
      
      // Navigate with standard wait 
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded', // Use domcontentloaded first for faster initial load
        timeout: 30000 // 30 second timeout for slow connections
      });
      
      // Random delays that mimic human behavior
      // Vary this with larger range to appear more human
      await this.page.waitForTimeout(1500 + Math.floor(Math.random() * 3000)); // 1.5-4.5 second random delay
      
      // Capture a screenshot after navigation
      await this.takeScreenshot('after_navigation');
      
      // Simulate human-like mouse movements (multi-point path with pauses)
      await this.simulateHumanMouseMovement();
      
      // Add some random scrolling behavior
      await this.simulateHumanScrolling();
      
      // Check page status - is it asking about browser security?
      const securityWarningPresent = await this.checkForSecurityWarning();
      
      if (securityWarningPresent) {
        log(`Security warning detected - trying to handle it`, 'warn');
        await this.handleSecurityWarning();
      }
      
      // Log the page title and URL for debugging
      const pageTitle = await this.page.title();
      const currentUrl = await this.page.url();
      log(`Page loaded - Title: "${pageTitle}", URL: ${currentUrl}`, 'info');
      
      // Capture HTML for debugging
      const pageContent = await this.page.content();
      const contentPreview = pageContent.substring(0, 500) + '...'; // First 500 chars
      log(`Page content preview: ${contentPreview}`, 'info');
      
      // Check for any of these common Google barriers
      const barriers = [
        { selector: '.g-recaptcha', name: 'reCAPTCHA' },
        { selector: 'iframe[src*="recaptcha"]', name: 'reCAPTCHA iframe' },
        { selector: 'div[data-action="verify"]', name: 'Device verification' },
        { selector: 'div[role="heading"][aria-level="2"]:has-text("Confirm it\'s you")', name: 'Confirm identity' },
        { selector: 'div[role="heading"][aria-level="2"]:has-text("Verify it\'s you")', name: 'Verify identity' },
        { selector: 'div[role="heading"][aria-level="2"]:has-text("This browser or app may not be secure")', name: 'Browser security warning' },
        { selector: 'div.jw8mI', name: 'Google security check' },
        { selector: 'div[aria-live="assertive"]', name: 'Security alert' }
      ];
      
      // Check each barrier
      for (const barrier of barriers) {
        try {
          const hasBarrier = await this.page.locator(barrier.selector).count() > 0;
          if (hasBarrier) {
            log(`${barrier.name} detected on page`, 'warn');
            await this.takeScreenshot(`detected_${barrier.name.toLowerCase().replace(/\s+/g, '_')}`);
            
            // Try to handle some barriers
            await this.handleSecurityBarrier(barrier.name, barrier.selector);
          }
        } catch (checkError) {
          // Non-critical - continue checking other barriers
          log(`Error checking for ${barrier.name}: ${checkError instanceof Error ? checkError.message : String(checkError)}`, 'warn');
        }
      }
      
      // Check for login elements more comprehensively
      const loginElements = [
        // Email input selectors in order of preference
        'input[type="email"]', 
        'input#identifierId', 
        'input[name="identifier"]',
        'div[aria-labelledby="headingText"]', 
        '#view_container',
        // Account chooser elements
        'div[data-list-index]', // Account chooser
        'div[jsname="bCkDte"]', // Account selection div
        'form[method="post"]' // Any form on the page
      ];
      
      // Look for any login element
      let foundLoginElement = false;
      for (const selector of loginElements) {
        try {
          const hasElement = await this.page.locator(selector).count() > 0;
          if (hasElement) {
            log(`Found login element: ${selector}`, 'info');
            foundLoginElement = true;
            break;
          }
        } catch (elementError) {
          // Continue checking other elements
          continue;
        }
      }
      
      if (!foundLoginElement) {
        log(`No login elements found on page - taking screenshot for debugging`, 'warn');
        await this.takeScreenshot('no_login_elements');
        log(`Currently at URL: ${currentUrl}`, 'info');
      }
    } catch (error) {
      // Take screenshot on navigation error
      const screenshotPath = await this.takeScreenshot('navigation_error');
      log(`Navigation error to ${url}, screenshot saved to ${screenshotPath}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      throw error;
    }
  }
  
  /**
   * Setup browser evasion measures to bypass security detection
   */
  private async setupEvasionMeasures(): Promise<void> {
    try {
      // Make navigator.webdriver return false (evade basic detection)
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
          configurable: true
        });
        
        // Add fake plugins and mimeTypes
        if (navigator.plugins) {
          Object.defineProperty(navigator, 'plugins', {
            get: () => {
              const plugins = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' },
                { name: 'Native Client', filename: 'internal-nacl-plugin' }
              ];
              plugins.item = function(index) { return this[index]; };
              plugins.namedItem = function(name) { return this.find(p => p.name === name); };
              plugins.refresh = function() {};
              plugins.length = plugins.length;
              return plugins;
            }
          });
        }
        
        // Add language support
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'es'],
          configurable: true
        });
        
        // Override permissions API
        if (navigator.permissions) {
          navigator.permissions.query = (function(originalQuery) {
            return function(parameters) {
              if (parameters.name === 'notifications' || 
                  parameters.name === 'clipboard-read' || 
                  parameters.name === 'clipboard-write') {
                return Promise.resolve({ state: 'granted', onchange: null });
              }
              return originalQuery.call(navigator.permissions, parameters);
            };
          })(navigator.permissions.query);
        }
        
        // Patch createdTouchList
        document.createTouchList = function() { 
          return document.createDocumentFragment(); 
        };
        
        // Mask headless mode
        Object.defineProperty(navigator, 'platform', { 
          get: () => 'MacIntel', 
          configurable: true 
        });
      });
      
      // Add random mouse movement on page
      await this.page.evaluate(() => {
        const div = document.createElement('div');
        div.setAttribute('id', 'mousemoveTracker');
        div.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none;');
        document.body.appendChild(div);
        
        // Track mouse movements
        document.onmousemove = function(e) {
          window.__lastMouseX = e.clientX;
          window.__lastMouseY = e.clientY;
        };
      });
    } catch (error) {
      log(`Warning: Error while setting up evasion measures: ${error}`, 'warn');
      // Non-critical error, continue without evasion measures
    }
  }
  
  /**
   * Simulate realistic human mouse movements
   */
  private async simulateHumanMouseMovement(): Promise<void> {
    try {
      const viewportSize = await this.page.viewportSize();
      if (!viewportSize) return;
      
      // Create a zigzag path across the page with pauses
      const points = [];
      const numPoints = 5 + Math.floor(Math.random() * 5); // 5-10 points
      
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: 50 + Math.floor(Math.random() * (viewportSize.width - 100)),
          y: 50 + Math.floor(Math.random() * (viewportSize.height - 100))
        });
      }
      
      // Move mouse through each point with variable speed
      for (const point of points) {
        // Variable speeds between points
        const steps = 5 + Math.floor(Math.random() * 10); // 5-15 steps
        await this.page.mouse.move(point.x, point.y, { steps });
        
        // Random pause at some points
        if (Math.random() < 0.3) { // 30% chance to pause
          await this.page.waitForTimeout(300 + Math.floor(Math.random() * 500));
        }
      }
    } catch (error) {
      log(`Error during mouse movement simulation: ${error}`, 'warn');
      // Non-critical error, continue without movement
    }
  }
  
  /**
   * Simulate human-like scrolling behavior
   */
  private async simulateHumanScrolling(): Promise<void> {
    try {
      // Get page height
      const pageHeight = await this.page.evaluate(() => {
        return document.body.scrollHeight;
      });
      
      if (pageHeight <= 0) return;
      
      // Random number of scroll actions
      const scrollActions = 1 + Math.floor(Math.random() * 3); // 1-3 scrolls
      
      for (let i = 0; i < scrollActions; i++) {
        // Scroll down by a random amount
        const scrollAmount = 100 + Math.floor(Math.random() * 300); // 100-400px
        await this.page.evaluate((amount) => {
          window.scrollBy(0, amount);
        }, scrollAmount);
        
        // Wait a random amount of time
        await this.page.waitForTimeout(500 + Math.floor(Math.random() * 1000)); // 500-1500ms
      }
      
      // 50% chance to scroll back up
      if (Math.random() < 0.5) {
        await this.page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await this.page.waitForTimeout(300 + Math.floor(Math.random() * 700)); // 300-1000ms
      }
    } catch (error) {
      log(`Error during scroll simulation: ${error}`, 'warn');
      // Non-critical error, continue without scrolling
    }
  }
  
  /**
   * Check if the page contains browser security warnings
   */
  private async checkForSecurityWarning(): Promise<boolean> {
    try {
      // Look for text indicating browser security issues
      const warningTexts = [
        'browser or app may not be secure',
        'This browser may not be secure',
        'This was blocked',
        'To keep your Google Account safe',
        'Verify it\'s you',
        'Couldn\'t sign you in',
        'browser security',
        'JavaScript',
        'cookies',
        'Your browser',
        'security check'
      ];
      
      // Check page text for any warning indicators
      const pageText = await this.page.evaluate(() => document.body.innerText);
      
      for (const warningText of warningTexts) {
        if (pageText.toLowerCase().includes(warningText.toLowerCase())) {
          log(`Security warning detected: "${warningText}"`, 'warn');
          await this.takeScreenshot(`security_warning_${warningText.replace(/\s+/g, '_').substring(0, 20)}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      log(`Error checking for security warnings: ${error}`, 'warn');
      return false;
    }
  }
  
  /**
   * Handle browser security warnings
   */
  private async handleSecurityWarning(): Promise<void> {
    try {
      // Capture screenshot for debugging
      await this.takeScreenshot('security_warning_detected');
      
      // Try clicking on various "Continue" or "Next" buttons that might appear in security dialogs
      const continueButtonSelectors = [
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("I understand")',
        'button:has-text("Allow")',
        'button:has-text("Accept")',
        'button:has-text("Agree")',
        'div[role="button"]:has-text("Continue")',
        'div[role="button"]:has-text("Next")',
        'span:has-text("Continue")',
        'span:has-text("Next")',
        'a:has-text("Continue")',
        'a:has-text("Next")',
        'input[type="submit"]'
      ];
      
      // Try to click any continue button
      for (const selector of continueButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            log(`Found continue button matching "${selector}" - clicking`, 'info');
            await button.click();
            log(`Clicked continue button`, 'info');
            
            // Wait for page changes
            await this.page.waitForTimeout(2000);
            return;
          }
        } catch (buttonError) {
          // Try next button selector
          continue;
        }
      }
      
      // If no buttons found, try JavaScript approach
      log(`No security warning buttons found, trying JavaScript approach`, 'info');
      
      await this.page.evaluate(() => {
        // Try to find and click elements
        const clickCandidates = [
          ...document.querySelectorAll('button'),
          ...document.querySelectorAll('div[role="button"]'),
          ...document.querySelectorAll('span[jsaction]'),
          ...document.querySelectorAll('input[type="submit"]')
        ];
        
        // Look for likely "Continue" buttons
        for (const element of clickCandidates) {
          const text = element.textContent || '';
          if (text.includes('Continue') || 
              text.includes('Next') || 
              text.includes('Allow') || 
              text.includes('Accept') ||
              text.includes('I understand')) {
            element.click();
            return true;
          }
        }
        
        return false;
      });
    } catch (error) {
      log(`Error handling security warning: ${error}`, 'warn');
      // Non-critical error, continue anyway
    }
  }
  
  /**
   * Handle specific security barriers
   */
  private async handleSecurityBarrier(barrierName: string, selector: string): Promise<void> {
    try {
      // Take screenshot for debugging
      await this.takeScreenshot(`handling_${barrierName.toLowerCase().replace(/\s+/g, '_')}`);
      
      if (barrierName.includes('reCAPTCHA')) {
        // Log but don't try to solve CAPTCHAs
        log(`CAPTCHA detected - this will likely block automation`, 'warn');
      }
      else if (barrierName.includes('Browser security warning')) {
        // Try to click "Continue anyway" type buttons
        const continueButtons = [
          'button.VfPpkd-LgbsSe:nth-child(2)',  // Often the second button is "Continue"
          'button:has-text("Continue")',
          'div[jsname="QkNstf"]', // Common "Next" button container
          'div[role="button"]:has-text("Continue")'
        ];
        
        for (const buttonSelector of continueButtons) {
          const hasButton = await this.page.locator(buttonSelector).count() > 0;
          if (hasButton) {
            log(`Clicking "${buttonSelector}" to continue past security warning`, 'info');
            await this.page.click(buttonSelector);
            return;
          }
        }
      }
      else if (barrierName.includes('Confirm identity') || barrierName.includes('Verify identity')) {
        // These typically need manual intervention, but we can try automated approaches
        log(`Identity verification detected - attempting to proceed`, 'warn');
        
        // Look for any "Try another way" options
        const alternativeOptions = [
          'button:has-text("Try another way")',
          'div[role="button"]:has-text("Try another way")',
          'a:has-text("Try another way")'
        ];
        
        for (const optionSelector of alternativeOptions) {
          const hasOption = await this.page.locator(optionSelector).count() > 0;
          if (hasOption) {
            log(`Clicking "${optionSelector}" to try alternative verification`, 'info');
            await this.page.click(optionSelector);
            await this.page.waitForTimeout(2000);
            return;
          }
        }
      }
    } catch (error) {
      log(`Error handling ${barrierName}: ${error}`, 'warn');
      // Non-critical error, continue
    }
  }
  
  /**
   * Get the current URL
   */
  public async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }
  
  /**
   * Get text content from a selector
   */
  public async getText(selector: string): Promise<string | null> {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      const element = await this.page.$(selector);
      if (!element) return null;
      return await element.textContent();
    } catch (error) {
      return null; // Return null if element not found
    }
  }
  
  /**
   * Click on a selector with improved reliability
   */
  public async click(selector: string, options?: { force?: boolean, timeout?: number }): Promise<void> {
    const timeout = options?.timeout || 10000;
    try {
      // Wait for the selector to be visible with better logging
      log(`Attempting to click: ${selector}`, 'info');
      
      // Try different click strategies
      try {
        // Strategy 1: Standard click with waitForSelector
        await this.page.waitForSelector(selector, { 
          state: 'visible',
          timeout 
        });
        
        await this.page.click(selector, { 
          force: options?.force || false,
          timeout 
        });
        
        log(`Successfully clicked using standard click: ${selector}`, 'info');
        return;
      } catch (error1) {
        // Take a screenshot of the error state
        const screenshotPath1 = await this.takeScreenshot(`click_attempt1_${selector.replace(/[^a-z0-9]/gi, '_')}`);
        log(`Standard click failed, trying JavaScript click: ${error1 instanceof Error ? error1.message : String(error1)}`, 'warn');
        
        try {
          // Strategy 2: Try using JavaScript click
          await this.page.evaluate((selectorText) => {
            const elements = document.querySelectorAll(selectorText);
            if (elements.length > 0) {
              const element = elements[0] as HTMLElement;
              element.click();
              return true;
            }
            return false;
          }, selector);
          
          log(`Successfully clicked using JavaScript click: ${selector}`, 'info');
          return;
        } catch (error2) {
          // Take another screenshot
          const screenshotPath2 = await this.takeScreenshot(`click_attempt2_${selector.replace(/[^a-z0-9]/gi, '_')}`);
          log(`JavaScript click failed: ${error2 instanceof Error ? error2.message : String(error2)}`, 'warn');
          
          // Try one last approach with force option
          try {
            // Strategy 3: Force click at the center of the element
            await this.page.click(selector, { 
              force: true, 
              timeout,
              position: { x: 5, y: 5 } // Try clicking near the top-left of the element
            });
            
            log(`Successfully clicked using force click: ${selector}`, 'info');
            return;
          } catch (error3) {
            // All strategies failed
            const finalScreenshot = await this.takeScreenshot(`all_click_methods_failed_${selector.replace(/[^a-z0-9]/gi, '_')}`);
            throw new Error(`All click methods failed for ${selector}: ${error3 instanceof Error ? error3.message : String(error3)}`);
          }
        }
      }
    } catch (error) {
      // Take screenshot on click error
      const screenshotPath = await this.takeScreenshot(`click_error_${selector.replace(/[^a-z0-9]/gi, '_')}`);
      console.error(`Error clicking element ${selector}, screenshot saved to ${screenshotPath}`, error);
      throw error;
    }
  }
  
  /**
   * Fill a form field with validation, using human-like behavior
   */
  public async fill(selector: string, value: string, options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout || 10000;
    try {
      // Wait for the selector to be visible and enabled
      await this.page.waitForSelector(selector, { 
        state: 'visible',
        timeout 
      });
      
      // First click on the field with a slight delay to simulate human focus
      await this.page.click(selector);
      
      // Random short pause before starting to type
      await this.page.waitForTimeout(300 + Math.floor(Math.random() * 500)); // 300-800ms pause
      
      // Clear the field first (important for inputs that might have existing values)
      await this.page.fill(selector, '');
      
      // Wait a tiny bit after clearing
      await this.page.waitForTimeout(50 + Math.floor(Math.random() * 150)); // 50-200ms pause
      
      // Type the value character by character with variable delays (more human-like behavior)
      for (let i = 0; i < value.length; i++) {
        // Simulate variable typing speed
        const typingSpeed = Math.floor(Math.random() * 100) + 50; // 50-150ms between keystrokes
        
        // Type a single character
        await this.page.type(selector, value[i], { delay: typingSpeed });
        
        // Occasionally pause while typing, as humans do
        if (i > 0 && i < value.length - 1 && Math.random() < 0.1) {
          // 10% chance of pausing mid-typing
          await this.page.waitForTimeout(300 + Math.floor(Math.random() * 700)); // 300-1000ms pause
        }
      }
      
      // Simulate a slight delay after typing before submitting
      await this.page.waitForTimeout(200 + Math.floor(Math.random() * 300)); // 200-500ms
      
      // Press Tab to move to the next field (common human behavior)
      await this.page.keyboard.press('Tab');
      
      // Verify the value was entered correctly
      const actualValue = await this.page.$eval(selector, (el: any) => el.value);
      if (actualValue !== value) {
        // Try once more with a different approach if the value wasn't entered correctly
        log(`Value mismatch: expected "${value}", got "${actualValue}". Retrying with direct fill.`, 'warn');
        await this.page.fill(selector, value);
        
        // Verify again
        const newValue = await this.page.$eval(selector, (el: any) => el.value);
        if (newValue !== value) {
          throw new Error(`Value still mismatched after retry: expected "${value}", got "${newValue}"`);
        }
      }
    } catch (error) {
      // Take screenshot on fill error
      const screenshotPath = await this.takeScreenshot(`fill_error_${selector.replace(/[^a-z0-9]/gi, '_')}`);
      console.error(`Error filling element ${selector}, screenshot saved to ${screenshotPath}`, error);
      throw error;
    }
  }
  
  /**
   * Wait for navigation to complete with improved error handling
   */
  public async waitForNavigation(options?: any): Promise<void> {
    try {
      await this.page.waitForNavigation({
        waitUntil: 'networkidle',
        timeout: 30000,
        ...options
      });
    } catch (error) {
      // Take screenshot on navigation wait error
      const screenshotPath = await this.takeScreenshot('navigation_wait_error');
      console.error(`Error waiting for navigation, screenshot saved to ${screenshotPath}`, error);
      throw error;
    }
  }
  
  /**
   * Wait for a selector to appear
   */
  public async waitForSelector(selector: string, options?: any): Promise<void> {
    try {
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: 10000,
        ...options
      });
    } catch (error) {
      // Take screenshot on selector wait error
      const screenshotPath = await this.takeScreenshot(`selector_wait_error_${selector.replace(/[^a-z0-9]/gi, '_')}`);
      console.error(`Error waiting for selector ${selector}, screenshot saved to ${screenshotPath}`, error);
      throw error;
    }
  }
  
  /**
   * Verify if an element exists and is visible
   */
  public async verifyElement(selector: string, options?: { timeout?: number }): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: options?.timeout || 5000
      });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Take a screenshot and return the file path
   */
  public async takeScreenshot(fileName?: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotFileName = fileName 
        ? `${fileName.replace(/[^a-z0-9_-]/gi, '_')}_${timestamp}.png`
        : this.getTimestampedFilename();
      
      // Get the file path (now an async operation)
      const filePath = await this.getScreenshotPath(screenshotFileName);
      
      await this.page.screenshot({ 
        path: filePath,
        fullPage: true
      });
      
      // Use controlled logging
      log(`Screenshot saved to: ${filePath}`, 'info');
      
      return filePath;
    } catch (error) {
      log(`Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return '';
    }
  }
  
  /**
   * Perform login on a website with comprehensive steps and error handling
   */
  public async performLogin(options: LoginOptions): Promise<LoginResult> {
    const startTime = Date.now();
    
    // Initialize results with steps tracking
    const result: LoginResult = {
      success: false,
      steps: [],
      debugInfo: {
        duration: 0,
        timestamps: {},
        screenshots: []
      }
    };
    
    // Take a screenshot at the beginning to see what page we're on
    await this.takeScreenshot('login_start');
    
    // Timeouts with defaults
    const timeouts = {
      email: options.timeouts?.email || 10000,
      password: options.timeouts?.password || 10000,
      navigation: options.timeouts?.navigation || 15000
    };
    
    try {
      // Get starting URL for debugging
      const startUrl = await this.getCurrentUrl();
      
      // Initialize step tracking
      const captureStep = async (stepName: string, status: 'success' | 'failed' | 'skipped' | 'pending', error?: string) => {
        const timestamp = Date.now();
        
        // Take screenshot if enabled
        let screenshotPath = '';
        if (options.captureScreenshots) {
          const screenshotPrefix = options.screenshotPrefix || 'login';
          const filename = `${screenshotPrefix}_${stepName.replace(/\s+/g, '_').toLowerCase()}_${status}`;
          screenshotPath = await this.takeScreenshot(filename);
          result.debugInfo!.screenshots!.push(screenshotPath);
        }
        
        // Record the step
        result.steps!.push({
          step: stepName,
          status,
          timestamp,
          error,
          screenshot: screenshotPath
        });
        
        // Record timestamp for debugging
        result.debugInfo!.timestamps[stepName] = timestamp;
        
        // Use our controlled logging function
        const level = status === 'failed' ? 'error' : 'info';
        log(`[LOGIN STEP] ${stepName}: ${status}${error ? ` - Error: ${error}` : ''}`, level);
      };
      
      // STEP 1: Email Entry
      await captureStep('Navigate to login page', 'success');
      
      // Take a detailed screenshot of the login page for debugging
      const initialScreenshot = await this.takeScreenshot('initial_login_page');
      result.debugInfo!.screenshots!.push(initialScreenshot);
      
      // Check for error messages or unexpected pages
      const initialPageContent = await this.page.content();
      const initialUrl = await this.getCurrentUrl();
      
      // Log the current URL and title for debugging
      const pageTitle = await this.page.title();
      log(`Current URL: ${initialUrl}`, 'info');
      log(`Page title: ${pageTitle}`, 'info');
      
      // Debug page content
      log(`Page content length: ${initialPageContent.length} characters`, 'info');
      
      // Check for the presence of key elements on the page
      try {
        const keyElements = [
          'input[type="email"]',
          'input#identifierId',
          'div#initialView',
          'button[type="button"]',
          'div[role="button"]',
          '.VfPpkd-LgbsSe',
          'form',
          'div#view_container'
        ];
        
        log('Checking for key page elements...', 'info');
        
        for (const selector of keyElements) {
          const count = await this.page.locator(selector).count();
          if (count > 0) {
            log(`Found ${count} elements matching: ${selector}`, 'info');
          }
        }
      } catch (elemCheckError) {
        log(`Error checking page elements: ${elemCheckError}`, 'warn');
      }
      
      // Helper function to detect Google 400 errors with various patterns
      const detectGoogle400Error = (content: string): boolean => {
        const errorPatterns = [
          '400. That\'s an error',
          'Error 400',
          'That\'s an error.',
          // Removed curly apostrophe pattern that was causing issues
          'Error 400:',
          'invalid_request',
          'The server cannot process the request',
          'Bad Request',
          'Error: disallowed_useragent'
        ];
        
        return errorPatterns.some(pattern => content.includes(pattern));
      };
      
      // Check for Google 400 errors with comprehensive detection
      if (detectGoogle400Error(initialPageContent)) {
        // Take a screenshot for debugging
        const screenshotPath = await this.takeScreenshot('google_400_error');
        
        // Use controlled logging
        log(`Google 400 error encountered: URL = ${initialUrl}`, 'error');
        log(`Screenshot saved to: ${screenshotPath}`, 'info');
        
        await captureStep('Check page state', 'failed', 'Server returned 400 error');
        
        // Try multiple recovery strategies with different URLs
        const recoveryUrls = [
          'https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn',
          'https://accounts.google.com/',
          'https://myaccount.google.com/'
        ];
        
        // Try each recovery URL
        let recoverySuccess = false;
        
        for (const recoveryUrl of recoveryUrls) {
          try {
            await captureStep(`Attempting recovery with ${recoveryUrl}`, 'pending');
            // Navigate to recovery URL
            await this.navigate(recoveryUrl);
            
            // Check if recovery worked by looking for 400 error again
            const newPageContent = await this.page.content();
            
            if (!detectGoogle400Error(newPageContent)) {
              // Recovery worked!
              await captureStep(`Recovery successful with ${recoveryUrl}`, 'success');
              recoverySuccess = true;
              break;
            } else {
              // Still getting 400 error, try next URL
              await captureStep(`Recovery with ${recoveryUrl} failed`, 'failed', 'Still getting 400 error');
            }
          } catch (recoveryError) {
            await captureStep(`Recovery with ${recoveryUrl} failed`, 'failed', 'Navigation error');
            await this.takeScreenshot(`recovery_failed_${recoveryUrl.replace(/[^a-z0-9]/gi, '_')}`);
            // Continue to next URL
          }
        }
        
        // If all recovery attempts failed, report the error
        if (!recoverySuccess) {
          return {
            ...result,
            error: 'Google login server returned a 400 error and recovery failed',
            errorCode: 'GOOGLE_400_ERROR_UNRECOVERABLE',
            message: 'The Google sign-in page encountered an error we could not recover from. Please try again later.',
            state: 'unknown'
          };
        }
        
        // Continue with normal flow after successful recovery
        log('Successfully recovered from Google 400 error', 'info');
      }
      
      // Check if we're already logged in
      if (initialPageContent.includes('Choose an account') || 
          this.page.url().includes('myaccount.google.com') || 
          this.page.url().includes('business.google.com/dashboard')) {
        await captureStep('Check logged in state', 'success', 'Already logged in or account chooser displayed');
        return {
          ...result,
          success: true,
          message: 'User appears to be already authenticated with Google',
          state: 'logged_in',
          currentUrl: await this.getCurrentUrl()
        };
      }
      
      // Wait for and fill email field
      await captureStep('Wait for email field', 'pending');
      try {
        // Check for page title to determine what step we're on
        const pageTitle = await this.page.title();
        
        if (pageTitle.includes('Sign in') || pageTitle.includes('Google Account')) {
          await this.waitForSelector(options.emailSelector, { timeout: timeouts.email });
          await captureStep('Wait for email field', 'success');
        } else {
          // If we're on an unexpected page, try to analyze it
          const bodyText = await this.page.$eval('body', (el) => el.textContent || '');
          await captureStep('Wait for email field', 'failed', `Unexpected page: ${pageTitle}`);
          
          // Take an additional screenshot for debugging
          await this.takeScreenshot('unexpected_google_page');
          
          return {
            ...result,
            error: `Unexpected Google page: ${pageTitle}`,
            errorCode: 'UNEXPECTED_PAGE',
            message: 'Landed on an unexpected Google page during login attempt.',
            state: 'unknown'
          };
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await captureStep('Wait for email field', 'failed', errorMsg);
        return {
          ...result,
          error: 'Email field not found',
          errorCode: 'EMAIL_FIELD_NOT_FOUND',
          message: 'Could not find the email input field on the login page.',
          state: 'unknown'
        };
      }
      
      // Fill email field with enhanced reliability
      await captureStep('Enter email address', 'pending');
      try {
        // Take a screenshot before entering email
        await this.takeScreenshot('before_email_entry');
        
        // Check for different forms of email input
        const emailFieldCount = await this.page.locator(options.emailSelector).count();
        log(`Found ${emailFieldCount} email input fields`, 'info');
        
        // Try different approaches to entering the email
        if (emailFieldCount > 0) {
          try {
            // First, try standard fill method
            await this.fill(options.emailSelector, options.credentials.email, { timeout: timeouts.email });
            log('Successfully entered email using standard fill', 'info');
          } catch (fillError) {
            log(`Standard fill failed: ${fillError}`, 'warn');
            
            // Try fallback method: direct input via evaluate
            await this.page.evaluate((selector, value) => {
              const inputs = document.querySelectorAll(selector);
              if (inputs.length > 0) {
                const input = inputs[0] as HTMLInputElement;
                input.value = value;
                
                // Trigger input events to ensure validation happens
                const event = new Event('input', { bubbles: true });
                input.dispatchEvent(event);
                
                const changeEvent = new Event('change', { bubbles: true });
                input.dispatchEvent(changeEvent);
              }
            }, options.emailSelector, options.credentials.email);
            
            log('Entered email using JavaScript fallback', 'info');
          }
        } else {
          // If no email fields found, check if we're on a different page
          const currentUrl = await this.getCurrentUrl();
          const pageTitle = await this.page.title();
          
          log(`No email field found. Current URL: ${currentUrl}, Title: ${pageTitle}`, 'warn');
          await this.takeScreenshot('no_email_field_detected');
          
          // Check for account chooser
          const hasAccountChooser = await this.page.locator('div[data-profileid], div[data-authuser], div[data-identifier]').count() > 0;
          
          if (hasAccountChooser) {
            log('Account chooser detected, will try to select an account', 'info');
            
            // Try to click the first account listed
            try {
              await this.page.click('div[data-profileid]:first-child, div[data-authuser="0"], div[data-identifier]:first-child');
              await this.page.waitForTimeout(2000);
              log('Clicked account in chooser', 'info');
              
              // Skip email entry since we've selected an account
              await captureStep('Enter email address', 'success', 'Used account chooser instead');
              result.steps!.push({
                step: 'Select from account chooser',
                status: 'success',
                timestamp: Date.now()
              });
              
              // Return early to skip to password step
              return {
                ...result,
                success: true,
                debugInfo: {
                  ...result.debugInfo,
                  accountChooserUsed: true
                }
              };
            } catch (accountError) {
              log(`Failed to select account: ${accountError}`, 'error');
              throw new Error(`No email field found and account selection failed`);
            }
          } else {
            throw new Error(`No email field found on page: ${pageTitle}`);
          }
        }
        
        // Verify email was entered successfully
        const emailValue = await this.page.evaluate((selector) => {
          const inputs = document.querySelectorAll(selector);
          return inputs.length > 0 ? (inputs[0] as HTMLInputElement).value : '';
        }, options.emailSelector);
        
        if (emailValue === options.credentials.email) {
          log(`Successfully verified email entry: ${emailValue}`, 'info');
        } else {
          log(`Email verification failed. Expected: ${options.credentials.email}, Got: ${emailValue}`, 'warn');
        }
        
        await captureStep('Enter email address', 'success');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await captureStep('Enter email address', 'failed', errorMsg);
        
        // Take screenshot of the error state
        await this.takeScreenshot('email_entry_failed');
        
        return {
          ...result,
          error: 'Failed to enter email',
          errorCode: 'EMAIL_ENTRY_FAILED',
          message: 'Could not enter email address in the input field.',
          state: 'email_error'
        };
      }
      
      // Click next after email with more comprehensive approach
      await captureStep('Click email next button', 'pending');
      try {
        // Take a screenshot before clicking
        await this.takeScreenshot('before_clicking_next');
        
        // Check how many Next buttons exist with different selector strategies
        const nextButtonCount = await this.page.locator(options.emailNextSelector).count();
        log(`Found ${nextButtonCount} potential next buttons`, 'info');
        
        // First attempt: Specifically identify and avoid clicking "Forgot email?" button
        try {
          // First, explicitly check for and log any "Forgot email?" buttons to avoid them
          const forgotEmailButtons = await this.page.locator('button:has-text("Forgot email"), a:has-text("Find your email")').count();
          if (forgotEmailButtons > 0) {
            log(`⚠️ CAUTION: Found ${forgotEmailButtons} "Forgot email?" buttons that we need to avoid`, 'warn');
            
            // Take a screenshot showing both buttons for debugging
            await this.takeScreenshot('detected_forgot_email_button');
            
            // Let's specifically look for the Next button in the most reliable way
            const nextButtonVisible = await this.page.locator('#identifierNext button, #identifierNext div[role="button"]').count() > 0;
            
            if (nextButtonVisible) {
              // Use the most specific selector possible to avoid clicking the wrong button
              await this.click('#identifierNext', { timeout: timeouts.email });
              log('Successfully clicked Next button container using specific selector', 'info');
            } else {
              // Try the most specific Next button selector we can craft
              await this.click('button[jsname="LgbsSe"]:not(:has-text("Forgot")):not(:has-text("Find"))', { timeout: timeouts.email });
              log('Successfully clicked Next button using filtered selector', 'info');
            }
          } else {
            // No "Forgot email?" button found, use normal approach
            await this.click(options.emailNextSelector, { timeout: timeouts.email });
            log('Successfully clicked Next button using standard click', 'info');
          }
          
          await this.page.waitForTimeout(1000); // Wait a bit to see the result
        } catch (clickError) {
          log(`Standard Next button click failed: ${clickError}`, 'warn');
          
          // Try pressing Enter key which often submits the form
          try {
            await this.page.press(options.emailSelector, 'Enter');
            log('Tried submitting by pressing Enter key', 'info');
            await this.page.waitForTimeout(1000);
          } catch (enterError) {
            log(`Enter key submission failed: ${enterError}`, 'warn');
          }
          
          // Try direct click on identifierNext which is the most common button ID
          try {
            await this.page.evaluate(() => {
              // Try a variety of methods to find and click ONLY the next button (not "Forgot email?")
              const possibleButtons = [
                document.querySelector('#identifierNext'),
                document.querySelector('#identifierNext button'),
                document.querySelector('#identifierNext div[role="button"]'),
                // Be extremely careful to avoid "Forgot email?" button which has similar styling
                // Only select buttons with explicit Next text or that are part of the identifierNext container
                Array.from(document.querySelectorAll('button, div[role="button"]'))
                  .find(el => {
                    // Make sure it's not the "Forgot email?" button
                    if (el.textContent?.includes('Forgot') || 
                        el.textContent?.includes('find') || 
                        el.textContent?.includes('Find') || 
                        el.getAttribute('aria-label')?.includes('Find') ||
                        el.getAttribute('aria-label')?.includes('forgot')) {
                      return false;
                    }
                    // Only accept buttons with "Next" text or buttons in the identifierNext container
                    return el.textContent?.includes('Next') || 
                           el.closest('#identifierNext') !== null;
                  })
              ];
              
              // Try to click the first valid button found
              for (const btn of possibleButtons) {
                if (btn) {
                  btn.click();
                  return true;
                }
              }
              return false;
            });
            
            log('Tried JavaScript direct click on Next button', 'info');
            await this.page.waitForTimeout(1000);
          } catch (jsError) {
            log(`JavaScript click failed: ${jsError}`, 'warn');
            // Last resort: try programmatically submitting the form
            await this.page.evaluate(() => {
              const form = document.querySelector('form');
              if (form) form.submit();
            });
          }
        }
        
        // Take a screenshot after click attempts
        await this.takeScreenshot('after_clicking_next');
        
        // Check if we've successfully moved to a new screen by looking for password field or other indicators
        const currentUrl = await this.getCurrentUrl();
        const movedToNextScreen = 
          await this.page.locator(options.passwordSelector).count() > 0 ||  // Password field visible
          currentUrl.includes('pwd') ||                                      // URL includes password indicator
          currentUrl.includes('challenge') ||                               // Challenge screen
          currentUrl.includes('signin/v2/challenge') ||                     // New challenge screen format
          currentUrl !== (await this.page.evaluate(() => window.history.state?.prevUrl || '')); // URL changed
          
        // Explicitly check if we accidentally went to "Find your email" page
        const onFindEmailPage = 
          currentUrl.includes('accountrecovery') || 
          currentUrl.includes('recovery') ||
          await this.page.locator('text="Find your email"').count() > 0 ||
          await this.page.locator('h1:has-text("Find your email")').count() > 0;
          
        if (onFindEmailPage) {
          log('ERROR: Accidentally navigated to "Find your email" page - this is not what we wanted', 'error');
          await this.takeScreenshot('accidentally_on_find_email_page');
          throw new Error('Accidentally clicked "Forgot email?" instead of Next button');
        }
        
        if (movedToNextScreen) {
          log('Successfully moved to next screen after email', 'info');
          await captureStep('Click email next button', 'success');
        } else {
          // Check for errors that might have appeared
          const hasEmailError = await this.verifyElement(options.emailErrorSelector, { timeout: 2000 });
          
          if (hasEmailError) {
            const errorText = await this.getText(options.emailErrorSelector) || 'Unknown email error';
            throw new Error(`Email validation error: ${errorText}`);
          } else {
            // Try one more time with a different approach
            await this.page.keyboard.press('Tab');
            await this.page.keyboard.press('Enter');
            await this.page.waitForTimeout(2000);
            
            const movedAfterRetry = await this.page.locator(options.passwordSelector).count() > 0;
            
            if (movedAfterRetry) {
              log('Moved to next screen after tab+enter retry', 'info');
              await captureStep('Click email next button', 'success', 'Succeeded with tab+enter fallback');
            } else {
              throw new Error('Multiple Next button click attempts failed');
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await captureStep('Click email next button', 'failed', errorMsg);
        
        // Take screenshot of error state
        await this.takeScreenshot('next_button_click_failed');
        
        // Check for "Find your email" message on page
        const pageText = await this.page.evaluate(() => document.body.innerText);
        if (pageText.toLowerCase().includes('find your email')) {
          return {
            ...result,
            error: 'Find your email',
            errorCode: 'EMAIL_NOT_FOUND',
            message: 'Google couldn\'t find your account with this email address',
            state: 'email_error'
          };
        }
        
        return {
          ...result,
          error: 'Failed to proceed after email',
          errorCode: 'EMAIL_NEXT_FAILED',
          message: 'Could not click the next button after entering email.',
          state: 'email_error'
        };
      }
      
      // Check for email errors if selector provided
      if (options.emailErrorSelector) {
        await captureStep('Check for email errors', 'pending');
        
        // Take screenshot to help with debugging
        await this.takeScreenshot('checking_for_email_errors');
        
        // Expanded error checking that's more comprehensive
        const hasEmailError = await this.verifyElement(options.emailErrorSelector, { timeout: 3000 });
        
        // Also check for specific text conditions that indicate errors even if the error element isn't found
        const pageContent = await this.page.content();
        const findYourEmailCondition = pageContent.toLowerCase().includes('find your email') || 
                                      pageContent.toLowerCase().includes('couldn\'t find your google account');
        
        if (hasEmailError || findYourEmailCondition) {
          // First try to get error text from selector
          let errorText = await this.getText(options.emailErrorSelector) || '';
          
          // If no text found or we detected special condition, look more broadly
          if (!errorText || findYourEmailCondition) {
            // Try to find "Find your email" text on page
            const findEmailText = await this.page.locator('text="Find your email"').count() > 0 ? 
              'Find your email' : 
              (await this.page.locator('text="Couldn\'t find your Google Account"').count() > 0 ? 
                'Couldn\'t find your Google Account' : 'Unknown email error');
            
            errorText = findEmailText;
          }
          
          // Take error screenshot
          await this.takeScreenshot('email_error_detected');
          
          await captureStep('Check for email errors', 'failed', errorText);
          return {
            ...result,
            error: errorText,
            errorCode: 'EMAIL_VALIDATION_ERROR',
            message: `Email validation error: ${errorText}`,
            state: 'email_error'
          };
        } else {
          await captureStep('Check for email errors', 'success');
        }
      }
      
      // STEP 2: Password Entry
      await captureStep('Wait for password field', 'pending');
      
      // Take a screenshot after email submission to see the password page
      await this.takeScreenshot('after_email_submission');
      
      // Enhanced logging to identify possible issues
      const passwordPageUrl = await this.getCurrentUrl();
      log(`Current URL before password field: ${passwordPageUrl}`, 'info');
      
      // Check if we're on a different page than expected
      if (passwordPageUrl.includes('challenge') || passwordPageUrl.includes('SelectChallenge') || 
          passwordPageUrl.includes('signin/rejected') || passwordPageUrl.includes('deniedsigninrejected')) {
        // We might be on a security check page
        log(`Detected security challenge page: ${passwordPageUrl}`, 'warn');
        await this.takeScreenshot('security_challenge_detected');
        
        // Try to identify if there are any continue buttons
        try {
          const buttonSelectors = [
            'button:has-text("Continue")',
            'button:has-text("Next")',
            'button:has-text("Try again")',
            'div[role="button"]:has-text("Continue")',
            'div[role="button"]:has-text("Try a different way")'
          ];
          
          // Check for and try to click any continue buttons
          for (const selector of buttonSelectors) {
            const hasButton = await this.page.locator(selector).count() > 0;
            if (hasButton) {
              log(`Found button on security page: ${selector}, attempting to click`, 'info');
              await this.click(selector);
              
              // Wait a bit and take another screenshot
              await this.page.waitForTimeout(3000);
              await this.takeScreenshot('after_security_button_click');
              
              // Check new URL
              const newUrl = await this.getCurrentUrl();
              log(`URL after security button click: ${newUrl}`, 'info');
              break;
            }
          }
        } catch (securityError) {
          log(`Error handling security page: ${securityError}`, 'error');
        }
      }
      
      // Check page content for common security messages
      try {
        const pageContent = await this.page.content();
        const securityPhrases = [
          'security check',
          'suspicious activity',
          'confirm it\'s you',
          'verify it\'s you',
          'browser or app may not be secure',
          'unusual activity'
        ];
        
        for (const phrase of securityPhrases) {
          if (pageContent.toLowerCase().includes(phrase.toLowerCase())) {
            log(`Security phrase detected: "${phrase}"`, 'warn');
            await this.takeScreenshot(`security_phrase_${phrase.replace(/\s+/g, '_')}`);
          }
        }
      } catch (contentError) {
        log(`Error checking page content: ${contentError}`, 'warn');
      }
      
      // Try multiple approaches to find the password field
      try {
        // First try normal approach with increased timeout
        try {
          await this.waitForSelector(options.passwordSelector, { timeout: timeouts.password * 2 });
          await captureStep('Wait for password field', 'success');
        } catch (firstError) {
          // If not found, check if account chooser is visible instead
          const accountChooserVisible = await this.page.locator('div[data-profileindex]').count() > 0 || 
                                       await this.page.locator('div[data-identifier]').count() > 0;
          
          if (accountChooserVisible) {
            log('Account chooser detected instead of password field', 'info');
            await this.takeScreenshot('account_chooser_detected');
            
            // Try to select the account
            try {
              await this.page.click('div[data-profileindex="0"], div[data-identifier]:first-child');
              await this.page.waitForTimeout(2000);
              
              // Now try to find the password field again
              await this.waitForSelector(options.passwordSelector, { timeout: timeouts.password });
              await captureStep('Wait for password field after account selection', 'success');
            } catch (accountError) {
              throw new Error(`Failed to select account: ${accountError}`);
            }
          } else {
            // If we're still on the email page, maybe the Next button didn't work
            const stillOnEmailPage = await this.page.locator(options.emailSelector).count() > 0;
            
            if (stillOnEmailPage) {
              log('Still on email page, Next button may not have worked', 'warn');
              await this.takeScreenshot('still_on_email_page');
              
              // Explicitly try the original Google-specific identifierNext button
              try {
                await this.page.click('#identifierNext');
                await this.page.waitForTimeout(2000);
                
                // Try to find password field again
                await this.waitForSelector(options.passwordSelector, { timeout: timeouts.password });
                await captureStep('Wait for password field after retry Next', 'success');
              } catch (nextError) {
                throw new Error(`Failed to click Next again: ${nextError}`);
              }
            } else {
              // If we're on an unknown page, report the original error
              throw firstError;
            }
          }
        }
      } catch (error) {
        // If all approaches failed, report the error with detailed information
        const errorMsg = error instanceof Error ? error.message : String(error);
        const currentPageUrl = await this.getCurrentUrl();
        const currentPageTitle = await this.page.title();
        
        await captureStep('Wait for password field', 'failed', errorMsg);
        return {
          ...result,
          error: 'Password field not found',
          errorCode: 'PASSWORD_FIELD_NOT_FOUND',
          message: `Could not find the password input field. Current URL: ${currentPageUrl}, Title: ${currentPageTitle}`,
          state: 'unknown'
        };
      }
      
      // Fill password field
      await captureStep('Enter password', 'pending');
      try {
        await this.fill(options.passwordSelector, options.credentials.password, { timeout: timeouts.password });
        await captureStep('Enter password', 'success');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await captureStep('Enter password', 'failed', errorMsg);
        return {
          ...result,
          error: 'Failed to enter password',
          errorCode: 'PASSWORD_ENTRY_FAILED',
          message: 'Could not enter password in the input field.',
          state: 'password_error'
        };
      }
      
      // Click login/next button
      await captureStep('Click password next button', 'pending');
      try {
        await this.click(options.passwordNextSelector, { timeout: timeouts.password });
        await captureStep('Click password next button', 'success');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await captureStep('Click password next button', 'failed', errorMsg);
        return {
          ...result,
          error: 'Failed to proceed after password',
          errorCode: 'PASSWORD_NEXT_FAILED',
          message: 'Could not click the submit button after entering password.',
          state: 'password_error'
        };
      }
      
      // Check for password errors if selector provided
      if (options.passwordErrorSelector) {
        await captureStep('Check for password errors', 'pending');
        
        // Take screenshot to help with debugging
        await this.takeScreenshot('checking_for_password_errors');
        
        // Expanded error checking with more comprehensive analysis
        const hasPasswordError = await this.verifyElement(options.passwordErrorSelector, { timeout: 3000 });
        
        // Also check for error conditions by analyzing page content
        const pageContent = await this.page.content();
        const pageText = await this.page.evaluate(() => document.body.innerText);
        
        // Common error conditions that might not match the error selectors
        const errorConditions = [
          { text: 'find your email', code: 'EMAIL_NOT_FOUND', message: 'Couldn\'t find your Google Account' },
          { text: 'couldn\'t find your google account', code: 'EMAIL_NOT_FOUND', message: 'Couldn\'t find your Google Account' },
          { text: 'wrong password', code: 'WRONG_PASSWORD', message: 'The password you entered is incorrect' },
          { text: 'incorrect password', code: 'WRONG_PASSWORD', message: 'Incorrect password' },
          { text: 'unusual activity', code: 'SUSPICIOUS_ACTIVITY', message: 'Google detected unusual activity' },
          { text: 'suspicious', code: 'SUSPICIOUS_ACTIVITY', message: 'Suspicious activity detected' },
          { text: 'verify it\'s you', code: 'VERIFICATION_REQUIRED', message: 'Google needs to verify it\'s you' },
          { text: 'confirm it\'s you', code: 'VERIFICATION_REQUIRED', message: 'Google needs additional confirmation' },
          { text: 'captcha', code: 'CAPTCHA_REQUIRED', message: 'CAPTCHA verification required' },
          { text: 'browser may not be secure', code: 'BROWSER_SECURITY', message: 'Browser security warning detected' },
          { text: 'browser or app may not be secure', code: 'BROWSER_SECURITY', message: 'Browser security warning detected' },
          { text: 'try again', code: 'RETRY_SUGGESTED', message: 'Google suggests trying again' }
        ];
        
        // Check for any error conditions in the page content
        let detectedError = null;
        for (const condition of errorConditions) {
          if (pageText.toLowerCase().includes(condition.text) || 
              pageContent.toLowerCase().includes(condition.text)) {
            detectedError = condition;
            break;
          }
        }
        
        // Process any errors found
        if (hasPasswordError || detectedError) {
          // First try to get error text from selector
          let errorText = await this.getText(options.passwordErrorSelector) || '';
          
          // If no text found or we detected special condition, use the detected error
          if (!errorText && detectedError) {
            errorText = detectedError.message;
          }
          
          // Take error screenshot
          await this.takeScreenshot('password_error_detailed');
          
          // Determine appropriate error code and message
          let errorCode = 'PASSWORD_VALIDATION_ERROR';
          let errorMessage = `Password validation error: ${errorText}`;
          
          // Use detected error if available
          if (detectedError) {
            errorCode = detectedError.code;
            errorMessage = detectedError.message;
          }
          // Otherwise use standard error detection
          else if (errorText.toLowerCase().includes('wrong password') || 
              errorText.toLowerCase().includes('incorrect') ||
              errorText.toLowerCase().includes('doesn\'t match')) {
            errorCode = 'WRONG_PASSWORD';
            errorMessage = 'The password you entered is incorrect. Please try again.';
          } else if (errorText.toLowerCase().includes('unusual activity') || 
                     errorText.toLowerCase().includes('suspicious')) {
            errorCode = 'SUSPICIOUS_ACTIVITY';
            errorMessage = 'Google detected unusual activity on this account. Please sign in directly on Google and resolve any security issues.';
          } else if (errorText.toLowerCase().includes('captcha') || 
                     errorText.toLowerCase().includes('verify')) {
            errorCode = 'CAPTCHA_REQUIRED';
            errorMessage = 'Google is requiring additional verification that our automation cannot complete. Please try logging in manually.';
          }
          
          await captureStep('Check for password errors', 'failed', errorText);
          return {
            ...result,
            error: errorText,
            errorCode,
            message: errorMessage,
            state: 'password_error'
          };
        } else {
          await captureStep('Check for password errors', 'success');
        }
      }
      
      // STEP 3: Handle 2FA if needed
      if (options.tfaSelector && await this.verifyElement(options.tfaSelector, { timeout: 3000 })) {
        await captureStep('Two-factor authentication required', 'pending');
        
        // Take a screenshot of the 2FA page
        await this.takeScreenshot('2fa_required');
        
        // If no TFA code provided, return with TFA required state
        if (!options.credentials.tfaCode) {
          await captureStep('Two-factor authentication required', 'failed', 'No TFA code provided');
          return {
            ...result,
            error: 'Two-factor authentication required',
            errorCode: 'TFA_REQUIRED',
            message: 'Two-factor authentication is required for this account. Please provide a verification code.',
            state: 'tfa_required'
          };
        }
        
        // Try to enter the TFA code if provided
        try {
          await this.fill(options.tfaSelector, options.credentials.tfaCode);
          if (options.tfaNextSelector) {
            await this.click(options.tfaNextSelector);
          }
          await captureStep('Two-factor authentication', 'success');
        } catch (tfaError) {
          const errorMsg = tfaError instanceof Error ? tfaError.message : String(tfaError);
          await captureStep('Two-factor authentication', 'failed', errorMsg);
          return {
            ...result,
            error: 'Failed to complete two-factor authentication',
            errorCode: 'TFA_ENTRY_FAILED',
            message: 'Could not enter or submit the two-factor authentication code',
            state: 'tfa_required'
          };
        }
      }
      
      // STEP 4: Verify successful login
      await captureStep('Verify successful login', 'pending');
      
      // Check if the success indicator is a URL pattern or a selector
      let loginSuccess = false;
      let currentUrl = '';
      
      // First, check the current URL to see if we're already at a success page
      currentUrl = await this.getCurrentUrl();
      
      // Handle multiple success URLs (comma-separated)
      const successUrls = options.successIndicator.split(',').map(url => url.trim());
      
      // Check if current URL already matches any of the success URLs
      for (const successUrl of successUrls) {
        if (successUrl.includes('.com/') && currentUrl.includes(successUrl)) {
          loginSuccess = true;
          await captureStep('Already at success URL', 'success', `URL: ${currentUrl}`);
          break;
        }
      }
      
      // If not already at success URL, wait for navigation
      if (!loginSuccess && (options.successIndicator.includes('.com/') || options.successIndicator.includes('http'))) {
        // Success is determined by URL
        try {
          // Wait for navigation to any of the success URLs
          await this.page.waitForNavigation({ 
            timeout: timeouts.navigation,
            waitUntil: 'networkidle'
          });
          
          // Get the new URL after navigation
          currentUrl = await this.getCurrentUrl();
          
          // Check if current URL matches any success URL
          for (const successUrl of successUrls) {
            if (successUrl.includes('.com/') && currentUrl.includes(successUrl)) {
              loginSuccess = true;
              break;
            }
          }
          
          if (loginSuccess) {
            await captureStep('Verify successful login', 'success', `URL: ${currentUrl}`);
          } else {
            await captureStep('Verify successful login', 'failed', `URL ${currentUrl} does not match any success indicator`);
            // Take additional screenshot for debugging
            await this.takeScreenshot('url_mismatch');
          }
        } catch (navError) {
          // Take screenshot on navigation error
          await this.takeScreenshot('login_navigation_error');
          
          // Read the page content to better understand the current state
          const pageContent = await this.page.content();
          const pageTitle = await this.page.title();
          
          // Check for common error messages
          const errorSelectors = [
            '.o6cuMc', // Google common error class
            'div[role="alert"]', // Accessibility error
            '.error-message', // Generic error class
            '#error-message', // Generic error ID
            '.OyEIQ', // Google specific error message
            '.GQ8Pzc', // Google specific error message
            '.EjBTad', // Google account error message
          ];
          
          let errorText = 'Unknown error during login verification';
          let errorDetected = false;
          
          // Check for account chooser - this could be a success condition
          if (pageTitle.includes('Choose an account') || pageContent.includes('Choose an account')) {
            loginSuccess = true;
            await captureStep('Account chooser detected', 'success');
            return {
              ...result,
              success: true,
              message: 'Reached Google account chooser screen, which indicates successful authentication',
              state: 'logged_in',
              currentUrl
            };
          }
          
          // Check for specific error elements
          for (const selector of errorSelectors) {
            if (await this.verifyElement(selector, { timeout: 2000 })) {
              errorText = await this.getText(selector) || errorText;
              errorDetected = true;
              break;
            }
          }
          
          if (errorDetected) {
            await captureStep('Verify successful login', 'failed', errorText);
            return {
              ...result,
              error: errorText,
              errorCode: 'LOGIN_FORM_ERROR',
              message: `Login error: ${errorText}`,
              state: 'unknown',
              currentUrl: await this.getCurrentUrl()
            };
          } else {
            await captureStep('Verify successful login', 'failed', 'Navigation timeout');
            return {
              ...result,
              error: navError instanceof Error ? navError.message : String(navError),
              errorCode: 'LOGIN_TIMEOUT',
              message: 'Login timed out waiting for success page',
              state: 'unknown',
              currentUrl: await this.getCurrentUrl()
            };
          }
        }
      } else {
        // Success is determined by a selector
        try {
          // Wait for the success element to appear
          await this.waitForSelector(options.successIndicator, { timeout: timeouts.navigation });
          loginSuccess = true;
          currentUrl = await this.getCurrentUrl();
          await captureStep('Verify successful login', 'success');
        } catch (selectorError) {
          currentUrl = await this.getCurrentUrl();
          await captureStep('Verify successful login', 'failed', 'Success element not found');
          return {
            ...result,
            error: selectorError instanceof Error ? selectorError.message : String(selectorError),
            errorCode: 'SUCCESS_ELEMENT_NOT_FOUND',
            message: 'Login verification failed: success element not found',
            state: 'unknown',
            currentUrl
          };
        }
      }
      
      // STEP 5: Final success or failure
      if (loginSuccess) {
        await captureStep('Login process complete', 'success');
        
        // Calculate total time
        const endTime = Date.now();
        result.debugInfo!.duration = endTime - startTime;
        
        return {
          ...result,
          success: true,
          message: 'Successfully logged in',
          state: 'logged_in',
          currentUrl
        };
      } else {
        await captureStep('Login process complete', 'failed', 'Login verification failed');
        
        // Calculate total time
        const endTime = Date.now();
        result.debugInfo!.duration = endTime - startTime;
        
        return {
          ...result,
          success: false,
          error: 'Login verification failed',
          errorCode: 'LOGIN_VERIFICATION_FAILED',
          message: 'Could not verify successful login',
          state: 'unknown',
          currentUrl
        };
      }
    } catch (error) {
      // Unexpected error in login process
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Take a screenshot of the error state
      const errorScreenshot = await this.takeScreenshot('login_unexpected_error');
      
      // Calculate duration even for errors
      const endTime = Date.now();
      result.debugInfo!.duration = endTime - startTime;
      
      if (result.debugInfo?.screenshots) {
        result.debugInfo.screenshots.push(errorScreenshot);
      }
      
      return {
        ...result,
        success: false,
        error: errorMsg,
        errorCode: 'LOGIN_PROCESS_ERROR',
        message: 'Unexpected error during login process',
        state: 'unknown',
        currentUrl: await this.getCurrentUrl()
      };
    }
  }
}

/**
 * Manages browser instances for automation
 */
export class BrowserManager {
  private instances: Map<string, BrowserInstance> = new Map();
  private expirationCheckInterval: NodeJS.Timeout | null = null;
  private readonly instanceTTL = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  constructor() {
    // Start the expiration check interval
    this.expirationCheckInterval = setInterval(() => {
      this.cleanupExpiredInstances();
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    // Handle process exit
    process.on('beforeExit', () => {
      this.shutdown();
    });
  }
  
  /**
   * Get or create a browser instance for the given key
   */
  public async getOrCreateInstance(key: string): Promise<string> {
    // If instance already exists, return its key
    if (this.instances.has(key)) {
      // Update last used timestamp
      const instance = this.instances.get(key)!;
      instance.lastUsed = new Date();
      return key;
    }
    
    // Create a new instance
    try {
      // Import Playwright dynamically to prevent server-side issues
      const { chromium } = await import('playwright');
      
      // Configure browser to evade common fingerprinting techniques
      const launchOptions = {
        headless: true, // Use headless browser in production
        // Don't use the Chrome channel - use default Chromium instead
        firefoxUserPrefs: {
          // Firefox-specific preferences for better evasion
          'privacy.resistFingerprinting': false, // Paradoxically, enabling this makes automation more detectable
          'dom.enable_performance': true,
          'dom.enable_resource_timing': true,
          'dom.enable_user_timing': true
        },
        args: [
          // Disable automation flags
          '--disable-blink-features=AutomationControlled',
          // Make automation less detectable
          '--no-default-browser-check',
          '--no-first-run',
          '--password-store=basic',
          // Set window size
          '--window-size=1280,800',
          // Suppress security warnings
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // Avoid language fingerprinting
          '--lang=en-US,en',
          // Allow third-party cookies for Google authentications
          '--disable-features=BlockThirdPartyCookies',
          // Enable cookies
          '--enable-cookies',
          // No info bars
          '--disable-infobars',
          // Emulate standard hardware 
          '--use-fake-ui-for-media-stream',
          // Allow clipboard access
          '--allow-clipboard-read',
          '--allow-clipboard-write',
          // Session storage
          '--unlimited-storage',
          // Disable popups and new window blocking
          '--disable-popup-blocking',
          // Don't block ads
          '--disable-ad-filtering',
          '--disable-component-update',
          // Accept all SSL certs
          '--ignore-certificate-errors',
          // Disable warnings
          '--disable-notifications',
          // WebGL for hardware fingerprinting
          '--enable-webgl',
          // Disable warnings
          '--enable-automation'
        ]
      };
      
      // Launch browser with stealth options
      const browser = await chromium.launch(launchOptions);
      
      // Generate realistic context settings
      const screenWidth = 1280;
      const screenHeight = 800;
      
      // Get actual user agent from a real Chrome instance
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
      ];
      const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
      
      // Create context with persistent storage to mimic real browser history
      const context = await browser.newContext({
        userAgent,
        viewport: { width: screenWidth, height: screenHeight },
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation', 'notifications', 'clipboard-read', 'clipboard-write'],
        acceptDownloads: true,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
        hasTouch: false,
        isMobile: false,
        // Allow cookies explicitly
        storageState: {
          cookies: [],
          origins: []
        },
        // Additional context parameters
        colorScheme: 'light',
        reducedMotion: 'no-preference',
        screen: {
          width: screenWidth,
          height: screenHeight
        }
      });
      
      // Configure the context further through specific settings
      await context.addInitScript(() => {
        // Create more convincing WebGL fingerprint
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
          value: function(contextType, contextAttributes) {
            const result = HTMLCanvasElement.prototype.getContext.apply(this, [contextType, contextAttributes]);
            if (contextType === 'webgl' || contextType === 'webgl2') {
              result.getParameter = function(parameter) {
                // Return common WebGL params that look like real hardware
                if (parameter === 37445) {
                  return 'Intel Inc.';
                }
                if (parameter === 37446) {
                  return 'Intel Iris Plus Graphics 640';
                }
                return result.getParameter(parameter);
              };
            }
            return result;
          }
        });
        
        // Setup navigator properties to avoid detection
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      });
      
      // Add additional stealth protection
      await context.addInitScript(() => {
        // Chrome-specific properties to mimic real browser
        Object.defineProperty(navigator, 'productSub', { get: () => '20030107' });
        Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
        
        // Mask CDP features by deleting special Chrome properties
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      });
      
      // Create new page with 3rd party cookies enabled
      const page = await context.newPage();
      
      // For Google login specifically, we need to enable cookies
      await page.context().clearCookies();
      await page.emulateMedia({ colorScheme: 'light' });
      
      // Create automation object for the page
      const automation = new PlaywrightAutomation(page);
      
      // Store the new instance
      this.instances.set(key, {
        browser,
        context,
        page,
        automation,
        lastUsed: new Date(),
        active: true
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Created new browser instance for key: ${key}`);
      }
      return key;
    } catch (error) {
      console.error(`Error creating browser instance for key ${key}:`, error);
      throw new Error(`Failed to create browser instance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if a browser instance exists
   */
  public async instanceExists(key: string): Promise<boolean> {
    return this.instances.has(key);
  }
  
  /**
   * Activate a browser instance (wake it from hibernation if needed)
   */
  public async activateInstance(key: string): Promise<void> {
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Browser instance not found for key: ${key}`);
    }
    
    // If instance is already active, just update the timestamp
    if (instance.active) {
      instance.lastUsed = new Date();
      return;
    }
    
    // If instance is hibernated, we need to recreate it
    try {
      // Import Playwright dynamically
      const { chromium } = await import('playwright');
      
      // Launch new browser
      const browser = await chromium.launch({
        headless: true, // Use headless browser in production
      });
      
      // Create new context
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });
      
      // Create new page
      const page = await context.newPage();
      
      // Create new automation object
      const automation = new PlaywrightAutomation(page);
      
      // Update the instance
      instance.browser = browser;
      instance.context = context;
      instance.page = page;
      instance.automation = automation;
      instance.lastUsed = new Date();
      instance.active = true;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Re-activated browser instance for key: ${key}`);
      }
    } catch (error) {
      console.error(`Error re-activating browser instance for key ${key}:`, error);
      throw new Error(`Failed to re-activate browser instance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get browser components for an instance
   */
  public async getInstanceComponents(key: string): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    automation: BrowserAutomation;
  }> {
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Browser instance not found for key: ${key}`);
    }
    
    // Make sure the instance is active
    if (!instance.active) {
      await this.activateInstance(key);
    }
    
    return {
      browser: instance.browser,
      context: instance.context,
      page: instance.page,
      automation: instance.automation
    };
  }
  
  /**
   * Update the last activity timestamp for an instance
   */
  public updateInstanceActivity(key: string): void {
    const instance = this.instances.get(key);
    if (instance) {
      instance.lastUsed = new Date();
    }
  }
  
  /**
   * Hibernate a browser instance to save resources
   * This closes the browser but keeps the instance record
   */
  private async hibernateInstance(key: string): Promise<void> {
    const instance = this.instances.get(key);
    if (!instance || !instance.active) {
      return;
    }
    
    try {
      // Before closing, clear cookies and local storage to reduce tracking
      if (instance.context) {
        try {
          await instance.context.clearCookies();
          
          // Clear storage to prevent tracking
          const page = instance.page;
          if (page) {
            await page.evaluate(() => {
              try {
                localStorage.clear();
                sessionStorage.clear();
                
                // Clear IndexedDB
                const deleteRequest = indexedDB.deleteDatabase('_session');
                deleteRequest.onsuccess = () => console.log('IndexedDB cleared');
              } catch (e) {
                // Ignore errors
              }
            });
          }
        } catch (storageError) {
          console.warn(`Error clearing browser storage: ${storageError instanceof Error ? storageError.message : String(storageError)}`);
          // Non-critical error, continue
        }
      }
      
      // Close the browser
      await instance.browser.close();
      
      // Mark as inactive
      instance.active = false;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Hibernated browser instance for key: ${key}`);
      }
    } catch (error) {
      console.error(`Error hibernating browser instance for key ${key}:`, error);
    }
  }
  
  /**
   * Remove a browser instance completely
   */
  public async removeInstance(key: string): Promise<boolean> {
    const instance = this.instances.get(key);
    if (!instance) {
      return false;
    }
    
    try {
      // Close the browser if it's active
      if (instance.active) {
        await instance.browser.close();
      }
      
      // Remove from the map
      this.instances.delete(key);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Removed browser instance for key: ${key}`);
      }
      return true;
    } catch (error) {
      console.error(`Error removing browser instance for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Clean up expired instances
   */
  private async cleanupExpiredInstances(): Promise<void> {
    const now = new Date();
    
    for (const [key, instance] of this.instances.entries()) {
      const elapsed = now.getTime() - instance.lastUsed.getTime();
      
      // If instance hasn't been used for a while
      if (elapsed > this.instanceTTL) {
        // First hibernate active instances to save resources
        if (instance.active && elapsed < this.instanceTTL * 2) {
          await this.hibernateInstance(key);
        } 
        // Then completely remove very old instances
        else if (elapsed > this.instanceTTL * 2) {
          await this.removeInstance(key);
        }
      }
    }
  }
  
  /**
   * Shutdown all browser instances
   */
  public async shutdown(): Promise<void> {
    // Clear the interval
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }
    
    // Close all browsers
    for (const [key, instance] of this.instances.entries()) {
      if (instance.active) {
        try {
          await instance.browser.close();
          if (process.env.NODE_ENV === 'development') {
            console.log(`Closed browser instance for key: ${key}`);
          }
        } catch (error) {
          console.error(`Error closing browser instance for key ${key}:`, error);
        }
      }
    }
    
    // Clear the map
    this.instances.clear();
  }
  
  /**
   * Get the total number of browser instances
   */
  public getInstanceCount(): number {
    return this.instances.size;
  }
  
  /**
   * Get the number of active browser instances
   */
  public getActiveInstanceCount(): number {
    let count = 0;
    for (const instance of this.instances.values()) {
      if (instance.active) {
        count++;
      }
    }
    return count;
  }
}