/**
 * Browser-use implementation for Google authentication
 * 
 * This file provides a browser-use based solution for Google authentication
 * to replace the raw Playwright implementation which has reliability issues.
 */

// Import Browser and Agent from browser-use
import { Browser, Agent } from '@browser-use/browser-use-node';
import { chromium, devices, BrowserContext, Page, ElementHandle } from 'playwright';

// Define credentials interface
interface GoogleCredentials {
  email: string;
  password: string;
}

// Define authentication result interface
interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
  sessionData?: any;
}

/**
 * Provides Google authentication using browser-use for higher reliability
 */
export class GoogleAuthenticator {
  private agent: Agent | null = null;
  private browserInstance: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotsDir: string;
  
  constructor(options?: { screenshotsDir?: string }) {
    this.screenshotsDir = options?.screenshotsDir || './screenshots';
  }
  
  /**
   * Initialize browser with advanced anti-detection measures
   */
  public async initialize(): Promise<void> {
    try {
      // Advanced stealth mode - comprehensive anti-detection with "normal browser" profile
      // Approach: Create a browser that mimics a standard user installation without automation hints
      
      // Generate realistic fingerprintable identity data
      const fpId = this.generateFingerprintIdentity();
      
      // Use specific older Chrome version to avoid detection of latest browser automation features
      // Chrome 120-122 range is good - recent enough but not bleeding edge
      const chromeVersion = ['120.0.6099.130', '121.0.6167.140', '122.0.6261.94'][Math.floor(Math.random() * 3)];
      
      // Check if we're in a Docker/container environment where headless is required
      // Use multiple detection methods for maximum reliability
      const isDocker = 
        process.env.RUNNING_IN_DOCKER === 'true' || 
        process.env.IN_CONTAINER === 'true' ||
        process.env.DOCKER === 'true' ||
        process.env.KUBERNETES_SERVICE_HOST !== undefined ||
        process.env.FORCE_HEADLESS === 'true' ||
        // In most container environments, we need to use headless mode
        true; // Force headless as default to be safe
      
      const browser = await chromium.launch({
        headless: true, // Always use headless mode for compatibility with containerized environments
        slowMo: 20, // Slows down all actions to appear more human
        args: [
          // Critical: Disable automation flags and fingerprinting surfaces
          '--disable-blink-features=AutomationControlled',
          '--disable-features=AutomationControlled',
          // Simulate real browser configurations
          `--user-agent=${fpId.userAgent}`,
          `--window-size=${fpId.screen.width},${fpId.screen.height}`,
          `--disable-gpu-vsync=true`,
          '--ignore-certificate-errors',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          // Disable extensions and components that could be fingerprinted
          '--disable-extensions',
          '--disable-component-extensions-with-background-pages',
          '--disable-default-apps',
          // Enable features that real browsers have
          '--enable-features=NetworkServiceInProcess2',
          // Randomize window activation to appear like normal usage
          Math.random() > 0.5 ? '--window-position=0,0' : `--window-position=${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 50)}`,
          '--no-first-run',
          '--no-sandbox',
          // Additional fingerprinting protection
          '--disable-reading-from-canvas',
          // Audio fingerprinting protection
          '--disable-audio-output',
          // WebRTC fingerprinting protection
          '--disable-webrtc-encryption',
          // Add fingerprint-breaking font randomization
          '--font-render-hinting=none',
          `--gpu-rasterization-msaa-sample-count=${[2, 4, 8][Math.floor(Math.random() * 3)]}`,
          // Docker-specific args for running in containers
          '--disable-dev-shm-usage', // Overcome limited /dev/shm size in containers
          '--no-zygote', // Disable zygote process to avoid sandbox issues in containers
          '--disable-gpu', // Disable GPU in containers (no hardware acceleration)
          '--single-process', // Use single process in containers for stability
        ],
        // Specify an exact Chrome version to make detection harder
        executablePath: process.env.CHROME_PATH || undefined,
        ignoreDefaultArgs: ['--enable-automation'],
      });
      
      // Create persistent context with cookies and storage to mimic a returning user
      // This is critical: persistent storage and cookies make the browser appear legitimate
      
      // Generate a random user data directory name for persistent storage
      const userDataDir = `./user-data-${Math.random().toString(36).substring(2, 10)}`;
      
      // Prepare cookies that mimic a real user (essential for Google's trust)
      const commonCookies = this.generateRealisticCookies();
      
      // Create context with pre-defined cookies and storage that approximates
      // what a real user's browser profile would look like
      this.context = await browser.newContext({
        // Human-like configuration
        userAgent: fpId.userAgent,
        viewport: { width: fpId.screen.width, height: fpId.screen.height },
        // Realistic geolocation - randomized within the US
        geolocation: fpId.geolocation,
        locale: fpId.locale,
        timezoneId: fpId.timezone,
        // Browser feature settings that vary by user
        permissions: ['geolocation', 'notifications', 'clipboard-read'],
        acceptDownloads: true,
        bypassCSP: true,
        colorScheme: fpId.colorScheme,
        reducedMotion: fpId.reducedMotion,
        forcedColors: fpId.forcedColors,
        deviceScaleFactor: fpId.deviceScaleFactor,
        hasTouch: fpId.hasTouch,
        // Random hardware concurrency to vary fingerprint
        devicePixelRatio: fpId.devicePixelRatio,
        // Audio/video capabilities
        isMobile: false,
        hasTouch: Math.random() > 0.8,
        // Browser screen dimensions
        screen: fpId.screen,
        // Storage configuration that persists between runs
        storageState: {
          cookies: commonCookies,
          origins: [
            {
              origin: 'https://google.com',
              localStorage: [
                { name: 'userSeen', value: 'true' },
                { name: 'visitCount', value: String(Math.floor(Math.random() * 30) + 5) },
                { name: 'lastVisit', value: new Date(Date.now() - Math.random() * 86400000 * 14).toISOString() },
                { name: 'optOut', value: Math.random() > 0.8 ? 'true' : 'false' },
                { name: 'theme', value: Math.random() > 0.3 ? 'light' : 'dark' },
              ]
            },
            {
              origin: 'https://accounts.google.com',
              localStorage: [
                { name: 'lastInteraction', value: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString() },
                { name: 'lastInteractionFlow', value: Math.random() > 0.5 ? 'signin' : 'accountChooser' },
                { name: 'browser_lso', value: 'true' },
                { name: 'WebsiteLastAccessed', value: String(Math.floor(Date.now() - Math.random() * 86400000 * 30)) },
              ]
            }
          ]
        }
      });
      
      // Create page with human-like behaviors
      this.page = await this.context.newPage();
      
      // Add client-side hooks to intercept and disarm fingerprinting
      await this.addAdvancedStealthScripts(fpId);
      
      // Setup browser-use Agent 
      this.agent = new Agent(this.page);
      
      // Random waiting behavior that simulates real pause before starting activity
      await this.humanWait(1500, 3000);
      
      // Configure page for taking screenshots
      await this.ensureScreenshotsDirectory();
      
      // Register event listeners to handle alerts and dialogs automatically
      this.page.on('dialog', async dialog => {
        console.log(`Dialog appeared: ${dialog.type()} with message: ${dialog.message()}`);
        
        // Wait a variable amount of time before responding (humans read the dialog)
        await this.humanWait(800, 2500);
        
        // Dismiss or accept based on dialog type
        if (dialog.type() === 'beforeunload') {
          await dialog.dismiss();
        } else {
          // For alerts and confirms, usually accept
          await dialog.accept();
        }
      });
      
      console.log('Browser initialized successfully with enhanced anti-detection');
    } catch (error) {
      // Detailed error logging for debugging
      console.error('Failed to initialize browser:', error);
      
      // Enhance error message with additional context
      let errorMessage = `Failed to initialize browser-use: ${error instanceof Error ? error.message : String(error)}`;
      
      // Add helpful diagnostic information
      if (error.toString().includes('Missing X server') || 
          error.toString().includes('XServer')) {
        errorMessage += ' | Container environment detected but X server missing. Make sure you are using headless mode in Docker/containers.';
      } else if (error.toString().includes('Failed to launch browser')) {
        errorMessage += ' | Browser launch failed. Verify Playwright dependencies are installed with `npx playwright install-deps chromium`.';
      }
      
      // Include browser logs in the error if available
      if (error.browserLogs) {
        errorMessage += ` | Browser logs: ${error.browserLogs}`;
      }
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Generate a consistent set of fingerprint-related identity values
   * to ensure coherent browser fingerprinting
   */
  private generateFingerprintIdentity() {
    // Platform detection - use more real-world values
    const platforms = [
      { 
        os: 'Windows', 
        version: ['10.0', '11.0'],
        browser: 'Chrome',
        browserVersions: ['120.0.0.0', '121.0.0.0', '122.0.0.0'],
        uaTemplate: 'Mozilla/5.0 (Windows NT $osver; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$chromeVer Safari/537.36'
      },
      { 
        os: 'Mac', 
        version: ['10_15_7', '12_6', '13_5', '14_3_1'],
        browser: 'Chrome',
        browserVersions: ['120.0.0.0', '121.0.0.0', '122.0.0.0'],
        uaTemplate: 'Mozilla/5.0 (Macintosh; Intel Mac OS X $osver) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/$chromeVer Safari/537.36'
      },
      { 
        os: 'Mac', 
        version: ['14_3_1', '14_2', '13_6'],
        browser: 'Safari',
        browserVersions: ['17.0', '17.2', '17.3'],
        uaTemplate: 'Mozilla/5.0 (Macintosh; Intel Mac OS X $osver) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/$chromeVer Safari/605.1.15'
      }
    ];
    
    // Choose a random platform configuration
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const osVersion = platform.version[Math.floor(Math.random() * platform.version.length)];
    const browserVersion = platform.browserVersions[Math.floor(Math.random() * platform.browserVersions.length)];
    
    // Generate a user agent string based on the selected platform
    const userAgent = platform.uaTemplate
      .replace('$osver', osVersion)
      .replace('$chromeVer', browserVersion);
    
    // Generate common screen resolutions
    const commonResolutions = [
      { width: 1366, height: 768 },   // Most common laptop
      { width: 1920, height: 1080 },  // Full HD
      { width: 1440, height: 900 },   // Common Mac resolution
      { width: 1280, height: 800 },   // Common laptop
      { width: 1536, height: 864 },   // Common laptop/desktop
      { width: 2560, height: 1440 },  // QHD
      { width: 1680, height: 1050 },  // Common for larger displays
    ];
    
    // Choose a random common resolution
    const screenResolution = commonResolutions[Math.floor(Math.random() * commonResolutions.length)];
    
    // Generate realistic viewport size (smaller than screen due to browser UI)
    const viewportWidth = screenResolution.width - Math.floor(Math.random() * 50) - 50;
    const viewportHeight = screenResolution.height - Math.floor(Math.random() * 100) - 100;
    
    // Choose a random common timezone
    const timezones = [
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Phoenix', 'America/Toronto', 'Europe/London', 'Europe/Paris'
    ];
    const timezone = timezones[Math.floor(Math.random() * timezones.length)];
    
    // Choose a random common locale
    const locales = ['en-US', 'en-GB', 'en-CA', 'es-US', 'fr-CA', 'en-AU'];
    const locale = locales[Math.floor(Math.random() * locales.length)];
    
    // Generate realistic geolocation
    const geolocationProfiles = [
      { latitude: 40.7128, longitude: -74.0060, accuracy: 100 }, // NYC
      { latitude: 34.0522, longitude: -118.2437, accuracy: 100 }, // LA
      { latitude: 41.8781, longitude: -87.6298, accuracy: 100 }, // Chicago
      { latitude: 29.7604, longitude: -95.3698, accuracy: 100 }, // Houston
      { latitude: 33.4484, longitude: -112.0740, accuracy: 100 }, // Phoenix
    ];
    const geolocation = geolocationProfiles[Math.floor(Math.random() * geolocationProfiles.length)];
    
    // Add variation to the exact coordinates
    geolocation.latitude += (Math.random() * 0.1) - 0.05;
    geolocation.longitude += (Math.random() * 0.1) - 0.05;
    geolocation.accuracy = Math.floor(Math.random() * 50) + 80;
    
    // More fingerprint variables
    const deviceScaleFactor = [1, 1.25, 1.5, 2][Math.floor(Math.random() * 4)];
    const devicePixelRatio = deviceScaleFactor;
    const colorScheme = Math.random() > 0.3 ? 'light' : 'dark';
    const reducedMotion = Math.random() > 0.9 ? 'reduce' : 'no-preference';
    const forcedColors = Math.random() > 0.97 ? 'active' : 'none';
    const hasTouch = Math.random() > 0.7;
    
    return {
      userAgent,
      platform: platform.os,
      screen: {
        width: screenResolution.width,
        height: screenResolution.height
      },
      viewport: {
        width: viewportWidth,
        height: viewportHeight
      },
      timezone,
      locale,
      geolocation,
      deviceScaleFactor,
      devicePixelRatio,
      colorScheme,
      reducedMotion,
      forcedColors,
      hasTouch,
      // Additional fingerprint data
      hardwareConcurrency: Math.floor(Math.random() * 8) + 4, // 4-12 cores
      deviceMemory: [2, 4, 8, 16][Math.floor(Math.random() * 4)], // 2-16 GB
      webglVendor: ['Google Inc.', 'Intel Inc.', 'NVIDIA Corporation'][Math.floor(Math.random() * 3)],
      webglRenderer: [
        'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)'
      ][Math.floor(Math.random() * 4)]
    };
  }
  
  /**
   * Generate realistic cookies that would be present in a browser
   * that has visited Google services before
   */
  private generateRealisticCookies() {
    // Current timestamp for TTL calculations
    const now = Date.now();
    
    // Common first-party Google cookies that a returning user would have
    return [
      {
        name: 'NID',
        value: this.generateRandomHex(128),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 180, // 6 months
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      },
      {
        name: '1P_JAR',
        value: `${new Date().toISOString().slice(0,10)}-${Math.floor(Math.random() * 20)}`,
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 30, // 30 days
        httpOnly: false,
        secure: true,
        sameSite: 'None'
      },
      {
        name: 'APISID',
        value: this.generateRandomHex(56),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 730, // 2 years
        httpOnly: false,
        secure: false
      },
      {
        name: 'HSID',
        value: this.generateRandomHex(56),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 730, // 2 years
        httpOnly: true,
        secure: false
      },
      {
        name: 'SSID',
        value: this.generateRandomHex(56),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 730, // 2 years
        httpOnly: true,
        secure: true
      },
      {
        name: 'SIDCC',
        value: this.generateRandomHex(96),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 90, // 90 days
        httpOnly: false,
        secure: true,
        sameSite: 'None'
      },
      {
        name: 'SID',
        value: this.generateRandomHex(69),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 730, // 2 years
        httpOnly: false,
        secure: true
      },
      {
        name: '__Secure-1PSID',
        value: this.generateRandomHex(69),
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 730, // 2 years
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      },
      {
        name: 'CONSENT',
        value: `YES+${this.generateRandomCharacters(20)}`,
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 730 * 10, // 20 years
        httpOnly: false,
        secure: true
      },
      {
        name: 'SEARCH_SAMESITE',
        value: 'CgQI-pcB',
        domain: '.google.com',
        path: '/',
        expires: now/1000 + 86400 * 180, // 6 months
        httpOnly: false,
        secure: true,
        sameSite: 'None'
      }
    ];
  }
  
  /**
   * Generate random hexadecimal string of specified length
   */
  private generateRandomHex(length: number): string {
    let result = '';
    const characters = '0123456789abcdef';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
  
  /**
   * Generate random alphanumeric string
   */
  private generateRandomCharacters(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }
  
  /**
   * Human-like waiting with variable duration
   */
  private async humanWait(min: number, max: number): Promise<void> {
    const waitTime = Math.floor(Math.random() * (max - min)) + min;
    await this.page.waitForTimeout(waitTime);
  }
  
  /**
   * Add advanced stealth scripts with consistent identity to avoid detection
   */
  private async addAdvancedStealthScripts(fpIdentity: any): Promise<void> {
    // Pass the fingerprint identity to ensure consistent values across all browser APIs
    await this.page.addInitScript((identity) => {
      // ==================== GENERAL ANTI-DETECTION ====================
      
      // Critical: Make navigator.webdriver false
      delete Object.getPrototypeOf(navigator).webdriver;
      
      // Override toString methods to hide native code modifications
      const nativeToString = Function.prototype.toString;
      const nativeObjectToString = Object.prototype.toString;
      const nativeObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
      const nativeObjectGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
      
      // Make all our overrides look like native code
      // This is critical for evading detection that looks for overridden toString methods
      Function.prototype.toString = function() {
        // If this is one of our modified functions, return what looks like native code
        if (this.name && this.__stealth) {
          return `function ${this.name}() { [native code] }`;
        }
        // Otherwise pass through to the native implementation
        return nativeToString.call(this);
      };
      Function.prototype.toString.__stealth = true;
      
      // ==================== BROWSER IDENTITY ====================
      
      // Unified approach: Apply all identity-related values in a consistent way
      // Consistency between different APIs is critical to avoid detection
      
      // Make it look like a normal browser with specific identity characteristics
      // Ensure all overridden values match each other exactly
      
      // Override navigator properties for a coherent identity
      const propsToModify = {
        // Basic identity
        userAgent: identity.userAgent,
        appVersion: identity.userAgent.replace('Mozilla/', ''),
        platform: identity.platform === 'Windows' ? 'Win32' : 'MacIntel',
        
        // Language settings
        language: identity.locale.split('-')[0],
        languages: [identity.locale, identity.locale.split('-')[0]],
        
        // Hardware characteristics
        hardwareConcurrency: identity.hardwareConcurrency,
        deviceMemory: identity.deviceMemory,
        
        // Vendor-specific properties
        vendor: identity.platform === 'Mac' ? 'Apple Computer, Inc.' : 'Google Inc.',
        productSub: '20030107',
        product: 'Gecko',
        
        // WebGL info must match user agent
        webglVendor: identity.webglVendor,
        webglRenderer: identity.webglRenderer,
        
        // Connection info
        connection: {
          effectiveType: ['4g', '3g'][Math.floor(Math.random() * 2)],
          rtt: Math.floor(Math.random() * 100) + 50,
          downlink: Math.floor(Math.random() * 10) + 5,
          saveData: Math.random() > 0.9
        }
      };
      
      // Apply all the overrides in a consistent way
      for (const [prop, value] of Object.entries(propsToModify)) {
        try {
          if (prop in navigator) {
            Object.defineProperty(navigator, prop, { get: () => value });
          }
        } catch (e) {
          // Some properties might be read-only, ignore errors
        }
      }
      
      // ==================== PLUGINS AND MIMETYPES ====================
      
      // Create realistic plugin array that matches identity
      const createPluginArray = () => {
        // Number of plugins varies by browser type
        const numPlugins = identity.platform === 'Mac' ? 
          Math.floor(Math.random() * 3) + 3 : 
          Math.floor(Math.random() * 5) + 4;
        
        const pluginNames = [
          'PDF Viewer', 
          'Chrome PDF Viewer', 
          'Chromium PDF Viewer', 
          'Microsoft Edge PDF Viewer',
          'WebKit built-in PDF', 
          'Native Client', 
          'Chrome Remote Desktop Viewer',
          'Widevine Content Decryption Module',
          'Chrome Media Router'
        ];
        
        const pluginDescriptions = [
          'Portable Document Format',
          'Portable Document Format',
          'Portable Document Format',
          'Portable Document Format',
          'Portable Document Format',
          'Native Client Executable',
          'Chrome Remote Desktop Viewer',
          'Enables Widevine licenses for playback of HTML audio/video content',
          'Presents dialog to cast content to other devices'
        ];
        
        const pluginFilenames = [
          'internal-pdf-viewer',
          'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          'internal-pdf-viewer',
          'microsoft-edge-pdf-viewer',
          'webkit-built-in-pdf',
          'internal-nacl-plugin',
          'internal-remoting-viewer',
          'widevinecdmadapter.dll',
          'internal-media-router'
        ];
        
        // Create a plugin array that looks like what the browser would have
        const plugins = [];
        for (let i = 0; i < numPlugins; i++) {
          const idx = i % pluginNames.length;
          plugins.push({
            name: pluginNames[idx],
            description: pluginDescriptions[idx],
            filename: pluginFilenames[idx],
            length: 1,
            item: () => null,
            namedItem: () => null
          });
        }
        
        // Make the array look and behave like a PluginArray
        plugins.refresh = () => {};
        plugins.namedItem = (name) => plugins.find(p => p.name === name) || null;
        plugins.item = (index) => plugins[index] || null;
        
        return plugins;
      };
      
      // Apply plugins override in a way that matches our identity
      const plugins = createPluginArray();
      
      // Only override if plugins exists in this browser
      if ('plugins' in navigator) {
        Object.defineProperty(navigator, 'plugins', {
          get: () => ({
            ...plugins,
            length: plugins.length
          })
        });
      }
      
      // Create mimeTypes that match our plugins
      const createMimeTypesArray = () => {
        const mimeTypes = [
          { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: plugins[0] },
          { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: plugins[0] },
          { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: plugins[0] },
          { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', enabledPlugin: plugins[2] },
          { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', enabledPlugin: plugins[2] },
        ];
        
        // Make it behave like a MimeTypeArray
        mimeTypes.namedItem = (name) => mimeTypes.find(m => m.type === name) || null;
        mimeTypes.item = (index) => mimeTypes[index] || null;
        
        return mimeTypes;
      };
      
      // Apply mimeTypes override
      const mimeTypes = createMimeTypesArray();
      
      if ('mimeTypes' in navigator) {
        Object.defineProperty(navigator, 'mimeTypes', {
          get: () => ({
            ...mimeTypes,
            length: mimeTypes.length
          })
        });
      }
      
      // ==================== CANVAS FINGERPRINTING PROTECTION ====================
      
      // More sophisticated canvas fingerprinting protection - very important for Google
      // The key is to be consistent but slightly different from standard
      if (CanvasRenderingContext2D.prototype) {
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        
        // Generate a consistent "fingerprint ID" for this browser session
        // This ensures we make the same modifications to any canvas operation
        const fingerprintSeed = parseInt(identity.userAgent.slice(-10).replace(/\D/g, '')) || Math.floor(Math.random() * 10000);
        
        // Override canvas data extraction methods
        CanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height) {
          // Get the real image data
          const imageData = originalGetImageData.call(this, x, y, width, height);
          
          // Skip modification for very small canvases (likely not fingerprinting)
          if (width < 16 || height < 16) return imageData;
          
          // Modify image data in a consistent way using our seed
          // This is more sophisticated than random noise - it creates consistent
          // but unique modifications that won't be detected as tampering
          
          // Only modify specific pixels based on image content and fingerprint seed
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Only modify if the position matches our fingerprint pattern
            // Complex enough to be unique, simple enough to be consistent
            if ((i/4) % (fingerprintSeed % 100 + 20) === 0) {
              // Modify pixel components slightly (red/green/blue/alpha)
              const mod = ((i % 255) + fingerprintSeed) % 3 - 1; // -1, 0, or 1
              
              // Only modify if it won't create obvious visual artifacts
              if (imageData.data[i] > 5 && imageData.data[i] < 250) {
                imageData.data[i] += mod;
              }
              
              // Also slightly modify green
              if (imageData.data[i+1] > 5 && imageData.data[i+1] < 250) {
                imageData.data[i+1] += mod;
              }
            }
          }
          
          return imageData;
        };
        
        // Mark as modified to avoid detection
        CanvasRenderingContext2D.prototype.getImageData.__stealth = true;
        
        // Override toDataURL with the same consistent modifications
        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
          // For small canvases, don't modify
          if (this.width < 16 || this.height < 16) {
            return originalToDataURL.call(this, type, quality);
          }
          
          // For potential fingerprinting canvases, apply our modifications
          const context = this.getContext('2d');
          if (context) {
            // Get the data, modify it using our overridden getImageData
            const imageData = context.getImageData(0, 0, this.width, this.height);
            // Put it back
            context.putImageData(imageData, 0, 0);
          }
          
          // Then proceed with normal toDataURL
          return originalToDataURL.call(this, type, quality);
        };
        
        // Also override toBlob for completeness
        HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
          // Apply same protection as toDataURL
          if (this.width >= 16 && this.height >= 16) {
            const context = this.getContext('2d');
            if (context) {
              const imageData = context.getImageData(0, 0, this.width, this.height);
              context.putImageData(imageData, 0, 0);
            }
          }
          
          // Call original with modified canvas
          return originalToBlob.call(this, callback, type, quality);
        };
        
        // Mark as modified
        HTMLCanvasElement.prototype.toDataURL.__stealth = true;
        HTMLCanvasElement.prototype.toBlob.__stealth = true;
      }
      
      // ==================== AUDIO FINGERPRINTING PROTECTION ====================
      
      // Add audio fingerprinting protection with the same consistent approach
      if (window.AudioContext || window.webkitAudioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const originalGetFloatFrequencyData = AudioContext.prototype.getFloatFrequencyData;
        const originalGetByteFrequencyData = AudioContext.prototype.getByteFrequencyData;
        const originalGetChannelData = AudioBuffer.prototype.getChannelData;
        
        // Add subtle consistent modifications to audio data
        if (originalGetChannelData) {
          AudioBuffer.prototype.getChannelData = function(channel) {
            const channelData = originalGetChannelData.call(this, channel);
            
            // Skip small buffers - likely not fingerprinting
            if (channelData.length > 1000) {
              // Modify specific samples based on our fingerprint seed
              const seed = parseInt(identity.userAgent.slice(-8).replace(/\D/g, '')) || 12345;
              
              // Add subtle modifications at specific intervals
              for (let i = 0; i < channelData.length; i += 500) {
                if ((i + seed) % 700 === 0) {
                  // Very subtle changes that won't be audible but will alter fingerprint
                  channelData[i] += (seed % 100) / 1000000;
                }
              }
            }
            
            return channelData;
          };
          AudioBuffer.prototype.getChannelData.__stealth = true;
        }
        
        // Also protect frequency analysis methods
        if (originalGetFloatFrequencyData) {
          AudioContext.prototype.getFloatFrequencyData = function(array) {
            originalGetFloatFrequencyData.call(this, array);
            
            // Apply subtle modifications
            for (let i = 0; i < array.length; i += 4) {
              array[i] += (Math.random() * 0.1) - 0.05;
            }
            
            return array;
          };
          AudioContext.prototype.getFloatFrequencyData.__stealth = true;
        }
        
        if (originalGetByteFrequencyData) {
          AudioContext.prototype.getByteFrequencyData = function(array) {
            originalGetByteFrequencyData.call(this, array);
            
            // Apply subtle modifications
            for (let i = 0; i < array.length; i += 4) {
              // Ensure we stay in 0-255 range for byte data
              array[i] = Math.max(0, Math.min(255, array[i] + Math.floor(Math.random() * 3) - 1));
            }
            
            return array;
          };
          AudioContext.prototype.getByteFrequencyData.__stealth = true;
        }
      }
      
      // ==================== SCREEN AND WINDOW PROPERTIES ====================
      
      // Set consistent screen properties to match our identity
      if (window.screen) {
        // Properties to modify
        const screenProps = {
          width: identity.screen.width,
          height: identity.screen.height,
          availWidth: identity.screen.width,
          availHeight: identity.screen.height - (identity.platform === 'Mac' ? 25 : 40), // Approx taskbar size
          colorDepth: 24,
          pixelDepth: 24
        };
        
        // Apply all the screen property overrides
        for (const [prop, value] of Object.entries(screenProps)) {
          if (prop in screen) {
            Object.defineProperty(screen, prop, { get: () => value });
          }
        }
      }
      
      // ==================== NAVIGATOR PERMISSIONS ====================
      
      // Override permissions API to give consistent responses
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = function(parameters) {
          // Return "granted" for these commonly checked permissions
          const autoGrant = [
            'notifications', 
            'clipboard-read', 
            'clipboard-write', 
            'notifications'
          ];
          
          // Determine permission state based on our identity
          if (autoGrant.includes(parameters.name)) {
            return Promise.resolve({ 
              state: 'granted', 
              onchange: null,
              // Add typical methods found on a PermissionStatus object
              addEventListener: () => {},
              removeEventListener: () => {},
              dispatchEvent: () => true
            });
          }
          
          // For all other permissions, pass through to the original
          return originalQuery.apply(navigator.permissions, arguments);
        };
        navigator.permissions.query.__stealth = true;
      }
      
      // ==================== BROWSER HISTORY AND NAVIGATION ====================
      
      // Create realistic browser history with length that matches our identity
      // This is important - scripts check history.length to detect new windows
      const historyLength = Math.floor(Math.random() * 30) + 5;
      
      // Override history.length
      Object.defineProperty(history, 'length', { 
        get: () => historyLength,
        set: () => {} // Ignore attempts to modify
      });
      
      // Override performance navigation to look like a regular browsing session
      if (window.performance) {
        if (performance.navigation) {
          Object.defineProperty(performance.navigation, 'type', { 
            value: Math.floor(Math.random() * 2) // Randomly 0 (navigate) or 1 (reload)
          });
          
          Object.defineProperty(performance.navigation, 'redirectCount', { 
            value: Math.floor(Math.random() * 3) // 0-2 redirects is typical
          });
        }
        
        // Adjust navigation timing to look natural
        // Very important for advanced fingerprinting that looks at page load patterns
        if (performance.timing) {
          // Make navigationStart appear to be slightly further in the past
          const navStart = performance.timing.navigationStart;
          const timeAdjustment = Math.floor(Math.random() * 100) + 20;
          
          // Adjust all timing values consistently to make it look realistic
          const timingProps = [
            'fetchStart', 'domainLookupStart', 'domainLookupEnd', 
            'connectStart', 'connectEnd', 'requestStart', 'responseStart', 
            'responseEnd', 'domLoading', 'domInteractive', 'domContentLoadedEventStart',
            'domContentLoadedEventEnd', 'domComplete', 'loadEventStart', 'loadEventEnd'
          ];
          
          timingProps.forEach(prop => {
            if (performance.timing[prop]) {
              try {
                Object.defineProperty(performance.timing, prop, {
                  get: () => performance.timing[prop] - timeAdjustment
                });
              } catch (e) {
                // Some properties might be read-only, ignore errors
              }
            }
          });
        }
      }
      
      // ==================== WEBRTC FINGERPRINTING PROTECTION ====================
      
      // Override WebRTC to prevent IP leaks and fingerprinting
      // Critical for advanced fingerprinting protection
      if (window.RTCPeerConnection || window.webkitRTCPeerConnection) {
        const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        const originalCreateOffer = RTCPeerConnection.prototype.createOffer;
        const originalCreateAnswer = RTCPeerConnection.prototype.createAnswer;
        const originalSetLocalDescription = RTCPeerConnection.prototype.setLocalDescription;
        
        // Override createOffer to modify ICE candidates
        RTCPeerConnection.prototype.createOffer = function() {
          const offerOptions = arguments.length > 0 ? arguments[0] : {};
          
          // Ensure the options prevent IP leakage
          const newOptions = {
            ...offerOptions,
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
            iceTransportPolicy: 'relay',
            iceCandidatePoolSize: 0
          };
          
          // Call original with modified options
          return originalCreateOffer.apply(this, [newOptions]);
        };
        RTCPeerConnection.prototype.createOffer.__stealth = true;
        
        // Do the same for createAnswer
        RTCPeerConnection.prototype.createAnswer = function() {
          const answerOptions = arguments.length > 0 ? arguments[0] : {};
          
          // Modified options
          const newOptions = {
            ...answerOptions,
            iceTransportPolicy: 'relay',
            iceCandidatePoolSize: 0
          };
          
          return originalCreateAnswer.apply(this, [newOptions]);
        };
        RTCPeerConnection.prototype.createAnswer.__stealth = true;
      }
      
      // ==================== GOOGLE-SPECIFIC PROTECTIONS ====================
      
      // Add Google-specific identity elements to fool reCAPTCHA and Google login
      // This is especially important for Google auth flows
      
      // Set Google-specific properties
      Object.defineProperty(navigator, 'appName', { get: () => 'Netscape' });
      
      // High-value entropy source for Google: Set "Accept-Language" header
      // browsers have consistent accept-language policies
      
      // Create a browser history specifically for Google domains
      const isGoogleDomain = window.location.hostname.includes('google.com') || 
                           window.location.hostname.includes('accounts.google') ||
                           window.location.hostname.includes('myaccount.google');
                           
      if (isGoogleDomain) {
        // For Google domains, simulate prior visits and history
        // Create natural-looking clientWidth values
        const docWidth = identity.screen.width - Math.floor(Math.random() * 50) - 10;
        Object.defineProperty(document.documentElement, 'clientWidth', { get: () => docWidth });
        
        const docHeight = identity.screen.height - Math.floor(Math.random() * 80) - 120;
        Object.defineProperty(document.documentElement, 'clientHeight', { get: () => docHeight });
        
        // Create consistent viewport properties
        Object.defineProperty(window, 'innerWidth', { get: () => docWidth });
        Object.defineProperty(window, 'innerHeight', { get: () => docHeight });
        Object.defineProperty(window, 'outerWidth', { get: () => identity.screen.width });
        Object.defineProperty(window, 'outerHeight', { get: () => identity.screen.height });
        
        // Previous visit cookie timestamps
        try {
          const yesterday = new Date(Date.now() - 86400000).toGMTString();
          document.cookie = `LAST_VISIT=${yesterday}; path=/; domain=${window.location.hostname}`;
        } catch (e) {
          // Ignoring cookie-setting errors
        }
      }
      
      // ==================== AUTOMATION DETECTOR BLOCKING ====================
      
      // Define key automation detector check functions and override them
      const touchPointClass = identity.hasTouch ? 'TouchPoint' : 'Point';
      
      // Ensure all automation detection functions return values consistent with our identity
      window.awesomium = undefined;
      window.domAutomation = undefined;
      window.domAutomationController = undefined;
      window._WEBDRIVER_ELEM_CACHE = undefined;
      window._phantom = undefined;
      window.callPhantom = undefined;
      window.PhantomEmitter = undefined;
      window.__nightmare = undefined;
      window.geb = undefined;
      window.__webdriver_script_fn = undefined;
      window.$chrome_asyncScriptInfo = undefined;
      window.__lastWatirAlert = undefined;
      window.__lastWatirConfirm = undefined;
      window.__lastWatirPrompt = undefined;
      window.__driver_evaluate = undefined;
      window.__webdriver_evaluate = undefined;
      window.__selenium_evaluate = undefined;
      window.__fxdriver_evaluate = undefined;
      window.__driver_unwrapped = undefined;
      window.__webdriver_unwrapped = undefined;
      window.__selenium_unwrapped = undefined;
      window.__fxdriver_unwrapped = undefined;
      window.__webdriverFunc = undefined;
      window.cdc_adoQpoasnfa76pfcZLmcfl_Array = undefined;
      window.cdc_adoQpoasnfa76pfcZLmcfl_Promise = undefined;
      window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol = undefined;
      
      // ==================== FINGERPRINT COHERENCE CHECK ====================
      
      // Run basic sanity checks to ensure our fingerprint is coherent
      // This makes sure we didn't miss any important identity elements
      window.setTimeout(() => {
        try {
          // Verify we have browser plugins
          if (navigator.plugins && navigator.plugins.length === 0) {
            console.warn('Stealth issue detected: No browser plugins');
          }
          
          // Verify canvas is working
          const testCanvas = document.createElement('canvas');
          testCanvas.width = 200;
          testCanvas.height = 50;
          const ctx = testCanvas.getContext('2d');
          if (ctx) {
            ctx.font = '20px Arial';
            ctx.fillText('Canvas Test', 10, 30);
            testCanvas.toDataURL();
          }
          
          // Verify screen properties match viewport
          if (window.innerWidth > screen.width || window.innerHeight > screen.height) {
            console.warn('Stealth issue detected: Window larger than screen');
          }
        } catch (e) {
          // Ignore any errors in our verification
        }
      }, 1000);
    }, fpIdentity);
    
    // After adding the page script, configure headers for subsequent navigation
    // Set custom headers that real browsers have
    this.page.setExtraHTTPHeaders({
      'sec-ch-ua': `"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"`,
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': fpIdentity.platform,
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': `${fpIdentity.locale},${fpIdentity.locale.split('-')[0]};q=0.9`,
      'cache-control': 'max-age=0',
    });
  }
  
  /**
   * Legacy stealth method kept for backward compatibility
   */
  private async addStealthScripts(): Promise<void> {
    // Initialize random browser history length - makes fingerprinting harder
    const historyLength = Math.floor(Math.random() * 30) + 5;
    
    await this.page.addInitScript(() => {
      // Mask Playwright/automation fingerprints
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Create complex plugins array with realistic values
      const numPlugins = Math.floor(Math.random() * 5) + 2;
      const mockPlugins = new Array(numPlugins).fill(null).map((_, i) => {
        return {
          name: ['PDF Viewer', 'Chrome PDF Viewer', 'Native Client', 'Widevine Content Decryption Module'][i % 4],
          description: ['Portable Document Format', 'Portable Document Format', 'Native Client Executable', 'Enables Widevine licenses for playback of HTML audio/video content'][i % 4],
          filename: ['internal-pdf-viewer', 'mhjfbmdgcfjbbpaeojofohoefgiehjai', 'internal-nacl-plugin', 'widevinecdmadapter.dll'][i % 4],
          length: 1
        };
      });
      
      // Override plugins property with realistic data
      if (navigator.plugins) {
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            return Object.setPrototypeOf(mockPlugins, Navigator.prototype);
          }
        });
      }
      
      // Override MIME types with realistic values
      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          const mimes = ['application/pdf', 'text/pdf', 'application/x-google-chrome-pdf', 'application/x-nacl', 'application/x-pnacl'];
          return Object.setPrototypeOf(
            mimes.map(type => ({ type })), 
            Navigator.prototype
          );
        }
      });
      
      // Create a more realistic languages array
      const languages = (Math.random() > 0.5) ? 
        ['en-US', 'en', 'es'] :
        ['en-US', 'en'];
        
      Object.defineProperty(navigator, 'languages', {
        get: () => languages
      });
      
      // Overwrite Chrome-specific properties with realistic values
      Object.defineProperty(navigator, 'productSub', { get: () => '20030107' });
      Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
      
      // Add a history with random length - more realistic browser behavior
      history.length = historyLength;
      
      // Override hardware concurrency (different per device)
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => Math.floor(Math.random() * 4) + 4
      });
      
      // Override device memory (different per device)
      if ("deviceMemory" in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => [2, 4, 8][Math.floor(Math.random() * 3)]
        });
      }
      
      // Override permissions API to prevent detection
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = function(parameters) {
          if (parameters.name === 'notifications' || 
              parameters.name === 'clipboard-read' || 
              parameters.name === 'clipboard-write') {
            return Promise.resolve({ state: 'granted', onchange: null });
          }
          return originalQuery.call(navigator.permissions, parameters);
        };
      }
      
      // Override getImageData to prevent canvas fingerprinting
      if (CanvasRenderingContext2D.prototype) {
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        CanvasRenderingContext2D.prototype.getImageData = function(x, y, width, height) {
          const imageData = originalGetImageData.call(this, x, y, width, height);
          // Add slight random noise to pixel data to prevent fingerprinting
          for (let i = 0; i < imageData.data.length; i += 100) {
            if (Math.random() < 0.01) {
              imageData.data[i] = imageData.data[i] + Math.floor(Math.random() * 3) - 1;
            }
          }
          return imageData;
        };
      }
      
      // Override AudioContext to prevent audio fingerprinting
      if (window.AudioContext) {
        const originalGetChannelData = AudioBuffer.prototype.getChannelData;
        if (originalGetChannelData) {
          AudioBuffer.prototype.getChannelData = function(channel) {
            const channelData = originalGetChannelData.call(this, channel);
            // Add slight random noise to audio data
            if (channelData.length > 0 && Math.random() < 0.1) {
              const random = Math.random() * 0.0001;
              channelData[Math.floor(Math.random() * channelData.length)] += random;
            }
            return channelData;
          };
        }
      }
      
      // Prevent detection via screen dimensions
      if (window.screen) {
        Object.defineProperty(screen, 'width', {
          value: window.innerWidth
        });
        Object.defineProperty(screen, 'height', {
          value: window.innerHeight
        });
        Object.defineProperty(screen, 'availWidth', {
          value: window.innerWidth
        });
        Object.defineProperty(screen, 'availHeight', {
          value: window.innerHeight
        });
      }
      
      // Chrome-specific overrides
      if (window.chrome) {
        window.chrome = {
          runtime: {},
          app: {
            InstallState: {
              DISABLED: 'disabled',
              INSTALLED: 'installed',
              NOT_INSTALLED: 'not_installed'
            },
            RunningState: {
              CANNOT_RUN: 'cannot_run',
              READY_TO_RUN: 'ready_to_run',
              RUNNING: 'running'
            },
            getDetails: () => {},
            getIsInstalled: () => {},
            installState: () => {}
          },
          loadTimes: () => ({}),
          csi: () => ({}),
          webstore: {}
        };
      }
    });
  }
  
  /**
   * Ensure screenshots directory exists
   */
  private async ensureScreenshotsDirectory(): Promise<void> {
    // Only run in Node.js environment, not in the browser
    if (typeof window === 'undefined') {
      try {
        // Use dynamic import instead of require
        const fs = await import('fs');
        if (!fs.existsSync(this.screenshotsDir)) {
          fs.mkdirSync(this.screenshotsDir, { recursive: true });
        }
      } catch (error) {
        console.warn(`Failed to create screenshots directory: ${error}`);
      }
    } else {
      console.log('Running in browser environment, skipping directory creation');
    }
  }
  
  /**
   * Simulates realistic human mouse movement using Bezier curves
   * 
   * Humans don't move mice in straight lines - they move in curved paths
   * with varying speeds
   */
  private async simulateHumanMouseMovement(element: ElementHandle): Promise<void> {
    if (!this.page) return;
    
    try {
      // Get the current mouse position
      const mouse = this.page.mouse;
      
      // Get the center of the element
      const box = await element.boundingBox();
      if (!box) return;
      
      const targetX = box.x + box.width / 2;
      const targetY = box.y + box.height / 2;
      
      // Get current mouse position (or use a default if not available)
      const currentPosition = { 
        x: this.page.viewportSize()?.width || 0 / 2, 
        y: this.page.viewportSize()?.height || 0 / 2 
      };
      
      // Human mouse movement has at least 3 control points for natural curve
      // We'll use a cubic Bezier curve (4 points: start, 2 control points, end)
      const startPoint = { x: currentPosition.x, y: currentPosition.y };
      const endPoint = { x: targetX, y: targetY };
      
      // Control points - offset from a straight line for natural curve
      // Add some randomness to the control points to create different curves each time
      const randomOffsetX1 = (Math.random() * 100) - 50;
      const randomOffsetY1 = (Math.random() * 100) - 50;
      const randomOffsetX2 = (Math.random() * 100) - 50;
      const randomOffsetY2 = (Math.random() * 100) - 50;
      
      const control1 = {
        x: startPoint.x + (endPoint.x - startPoint.x) * 0.3 + randomOffsetX1,
        y: startPoint.y + (endPoint.y - startPoint.y) * 0.3 + randomOffsetY1
      };
      
      const control2 = {
        x: startPoint.x + (endPoint.x - startPoint.x) * 0.7 + randomOffsetX2,
        y: startPoint.y + (endPoint.y - startPoint.y) * 0.7 + randomOffsetY2
      };
      
      // Number of steps - humans move the mouse fairly quickly but not instantly
      // More steps = smoother movement, but slower
      const steps = 10 + Math.floor(Math.random() * 15);
      
      // Move through the Bezier curve with non-linear speed (starts slower, speeds up, slows at end)
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        
        // Cubic Bezier curve formula
        const bezierX = Math.pow(1 - t, 3) * startPoint.x + 
                      3 * Math.pow(1 - t, 2) * t * control1.x + 
                      3 * (1 - t) * Math.pow(t, 2) * control2.x + 
                      Math.pow(t, 3) * endPoint.x;
                      
        const bezierY = Math.pow(1 - t, 3) * startPoint.y + 
                      3 * Math.pow(1 - t, 2) * t * control1.y + 
                      3 * (1 - t) * Math.pow(t, 2) * control2.y + 
                      Math.pow(t, 3) * endPoint.y;
        
        // Move the mouse to this point with eased timing function
        await mouse.move(bezierX, bezierY);
        
        // Human mouse movements aren't perfectly smooth - add slight delay
        // which varies based on where in the curve we are
        const delay = Math.random() * 10 + (t < 0.2 || t > 0.8 ? 5 : 2);
        await this.page.waitForTimeout(delay);
      }
      
      // Small pause at the end before clicking (humans often hesitate slightly)
      await this.page.waitForTimeout(Math.floor(Math.random() * 200) + 50);
    } catch (error) {
      console.warn(`Error in human mouse movement: ${error}`);
      // Fallback to direct movement if something goes wrong
      const box = await element.boundingBox();
      if (box) {
        await this.page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2
        );
      }
    }
  }
  
  /**
   * Simulates realistic human typing with mistakes and corrections
   * 
   * Humans don't type at consistent speeds and sometimes make typos
   */
  private async simulateHumanTyping(text: string): Promise<void> {
    if (!this.page) return;
    
    try {
      // Define typing characteristics
      const typingSpeed = {
        min: 50 + Math.floor(Math.random() * 30), // Min milliseconds between keystrokes
        max: 150 + Math.floor(Math.random() * 50)  // Max milliseconds between keystrokes
      };
      
      // Probability settings
      const errorProbability = 0.01; // Chance of making a typo
      const correctionDelay = 200 + Math.floor(Math.random() * 300); // Time before correcting a typo
      const pauseProbability = 0.05; // Chance of brief pause while typing
      const pauseDuration = { 
        min: 300, 
        max: 800 
      };
      
      // Define adjacent keys for realistic typos (common QWERTY layout)
      const adjacentKeys: Record<string, string[]> = {
        'a': ['q', 'w', 's', 'z'],
        'b': ['v', 'g', 'h', 'n'],
        'c': ['x', 'd', 'f', 'v'],
        // ... could add more, but these are sufficient for demo
        'e': ['w', 's', 'd', 'r'],
        'm': ['n', 'j', 'k'],
        'n': ['b', 'h', 'j', 'm'],
        'o': ['i', 'k', 'l', 'p'],
        's': ['a', 'w', 'e', 'd', 'x', 'z'],
        't': ['r', 'f', 'g', 'y'],
        // Special case for the @ symbol in emails
        '@': ['2', '#', '!']
      };
      
      // Type each character with variable speed
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Decide if we'll make a typo
        if (Math.random() < errorProbability) {
          // Choose a random adjacent key as a typo
          const possibleTypos = adjacentKeys[char.toLowerCase()] || [];
          if (possibleTypos.length > 0) {
            const typo = possibleTypos[Math.floor(Math.random() * possibleTypos.length)];
            
            // Type the typo
            await this.page.keyboard.type(typo, { 
              delay: Math.floor(Math.random() * (typingSpeed.max - typingSpeed.min)) + typingSpeed.min 
            });
            
            // Pause briefly as if noticing the error
            await this.page.waitForTimeout(correctionDelay);
            
            // Delete the typo
            await this.page.keyboard.press('Backspace');
            
            // Another brief pause before typing correct character
            await this.page.waitForTimeout(Math.floor(Math.random() * 200) + 50);
          }
        }
        
        // Type the correct character with variable delay
        await this.page.keyboard.type(char, { 
          delay: Math.floor(Math.random() * (typingSpeed.max - typingSpeed.min)) + typingSpeed.min 
        });
        
        // Occasionally pause while typing (like a human thinking or distracted)
        if (Math.random() < pauseProbability) {
          const pauseTime = Math.floor(Math.random() * (pauseDuration.max - pauseDuration.min)) + pauseDuration.min;
          await this.page.waitForTimeout(pauseTime);
        }
      }
      
      // Final pause after typing (humans typically pause after completing input)
      await this.page.waitForTimeout(Math.floor(Math.random() * 300) + 100);
      
    } catch (error) {
      console.warn(`Error in human typing simulation: ${error}`);
      // Fall back to simple typing if something goes wrong
      await this.page.keyboard.type(text, { delay: 100 });
    }
  }
  
  /**
   * Take a screenshot with a timestamp
   */
  private async takeScreenshot(name: string): Promise<string> {
    if (!this.page) return '';
    
    // Skip screenshot in browser environment
    if (typeof window !== 'undefined') {
      console.log(`[Browser] Would take screenshot: ${name} (skipped in browser)`);
      return '';
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `${name}_${timestamp}.png`;
      const path = `${this.screenshotsDir}/${filename}`;
      
      await this.page.screenshot({ path, fullPage: true });
      return path;
    } catch (error) {
      console.warn(`Failed to take screenshot: ${error}`);
      return '';
    }
  }
  
  /**
   * Simulate natural user exploration before performing key actions
   * Humans often look around a page, pause, move the mouse over various elements
   * before taking their primary action
   */
  private async simulateNaturalExploration(): Promise<void> {
    if (!this.page) return;
    
    try {
      console.log('Simulating natural user exploration behavior...');
      
      // Random exploration activities
      const explorationActivities = [
        // Scroll exploration
        async () => {
          // Scrolling behavior pattern: initial scroll down, pause, then back up slightly
          const scrollY = Math.floor(Math.random() * 300) + 100;
          await this.page.evaluate((y) => window.scrollBy(0, y), scrollY);
          await this.humanWait(500, 1200);
          // Sometimes scroll back up a bit
          if (Math.random() > 0.6) {
            await this.page.evaluate(() => window.scrollBy(0, -100));
          }
        },
        
        // Move mouse to random elements 
        async () => {
          // Find visible links or buttons to potentially hover
          const elements = await this.page.$$('a, button, input, select, .clickable, [role="button"]');
          if (elements.length > 0) {
            // Choose a random element to explore
            const randomElement = elements[Math.floor(Math.random() * elements.length)];
            
            // Check if element is visible before interacting
            const isVisible = await randomElement.isVisible().catch(() => false);
            if (isVisible) {
              // Move to the element with human-like movement
              await this.simulateHumanMouseMovement(randomElement);
              
              // Occasionally hover for a bit
              await this.humanWait(300, 1500);
            }
          }
        },
        
        // Inspect page content - move to headings or text
        async () => {
          const textElements = await this.page.$$('h1, h2, h3, p, li, .text, [role="heading"]');
          if (textElements.length > 0) {
            const randomText = textElements[Math.floor(Math.random() * textElements.length)];
            
            // Check if element is visible before interacting
            const isVisible = await randomText.isVisible().catch(() => false);
            if (isVisible) {
              // Move to the text element with human-like movement
              await this.simulateHumanMouseMovement(randomText);
              
              // Sometimes mimic reading by staying on text for a while
              if (Math.random() > 0.5) {
                await this.humanWait(800, 2000);
              }
            }
          }
        },
        
        // Pause as if thinking/reading
        async () => {
          const pauseTime = Math.floor(Math.random() * 1500) + 500;
          await this.page.waitForTimeout(pauseTime);
        },
        
        // Move mouse randomly to empty areas
        async () => {
          const viewportSize = await this.page.viewportSize();
          if (viewportSize) {
            // Pick a random point in the viewport
            const x = Math.floor(Math.random() * viewportSize.width * 0.8) + (viewportSize.width * 0.1);
            const y = Math.floor(Math.random() * viewportSize.height * 0.8) + (viewportSize.height * 0.1);
            
            // Use Bezier curve movement for natural mouse movement
            const startPoint = await this.page.mouse.position();
            
            // Create control points for Bezier curve
            const control1 = {
              x: startPoint.x + (x - startPoint.x) * 0.3 + (Math.random() * 100 - 50),
              y: startPoint.y + (y - startPoint.y) * 0.3 + (Math.random() * 100 - 50)
            };
            
            const control2 = {
              x: startPoint.x + (x - startPoint.x) * 0.7 + (Math.random() * 100 - 50),
              y: startPoint.y + (y - startPoint.y) * 0.7 + (Math.random() * 100 - 50)
            };
            
            // Number of steps and delays similar to simulateHumanMouseMovement
            const steps = 10 + Math.floor(Math.random() * 15);
            
            for (let i = 0; i <= steps; i++) {
              const t = i / steps;
              
              // Cubic Bezier curve calculation
              const bezierX = Math.pow(1 - t, 3) * startPoint.x + 
                            3 * Math.pow(1 - t, 2) * t * control1.x + 
                            3 * (1 - t) * Math.pow(t, 2) * control2.x + 
                            Math.pow(t, 3) * x;
                            
              const bezierY = Math.pow(1 - t, 3) * startPoint.y + 
                            3 * Math.pow(1 - t, 2) * t * control1.y + 
                            3 * (1 - t) * Math.pow(t, 2) * control2.y + 
                            Math.pow(t, 3) * y;
              
              await this.page.mouse.move(bezierX, bezierY);
              const delay = Math.random() * 10 + 3;
              await this.page.waitForTimeout(delay);
            }
          }
        }
      ];
      
      // Choose a random number of exploration activities
      const numActivities = Math.floor(Math.random() * 3) + 1;
      
      // Perform several random exploration activities
      for (let i = 0; i < numActivities; i++) {
        // Choose a random activity
        const randomActivity = explorationActivities[Math.floor(Math.random() * explorationActivities.length)];
        
        // Perform the activity
        await randomActivity();
      }
      
    } catch (error) {
      // Exploration is non-critical, so just log and continue if it fails
      console.warn(`Error in natural exploration: ${error}`);
    }
  }
  
  /**
   * Check and handle Google's suspicious activity challenges
   */
  private async handleChallengePage(): Promise<boolean> {
    if (!this.page) return false;
    
    // Check for common challenge indicators
    const isChallengeUrl = this.page.url().includes('/signin/challenge') || 
                          this.page.url().includes('/signin/rejected') ||
                          this.page.url().includes('/signin/v2/challenge') ||
                          this.page.url().includes('/disabled/explanation') ||
                          this.page.url().includes('unusualactivity');
    
    if (isChallengeUrl) {
      await this.takeScreenshot('challenge_detected');
      console.log('Challenge page detected! URL:', this.page.url());
      
      // Check for common challenge types
      const pageText = await this.page.evaluate(() => document.body.innerText);
      
      // Look for common challenge messages
      if (pageText.includes('suspicious activity') || 
          pageText.includes('unusual activity') ||
          pageText.includes('prove you\'re not a robot') ||
          pageText.includes('verify it\'s you') ||
          pageText.includes('confirm it\'s you')) {
        
        console.log('Detected Google account security challenge');
        return true;
      }
      
      // Check for device confirmation
      if (pageText.includes('recognize this device') || 
          pageText.includes('device you\'re using')) {
        console.log('Detected device confirmation challenge');
        return true;
      }
      
      // Catch-all for any challenge page
      if (isChallengeUrl) {
        console.log('Detected unknown challenge type');
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Authenticate with Google using browser-use
   * This method uses browser-use's high-level abstractions for more reliable automation
   * with enhanced human-like behavior and anti-detection
   */
  public async authenticateGoogle(credentials: GoogleCredentials, options?: { 
    url?: string,
    timeout?: number
  }): Promise<AuthResult> {
    if (!this.agent || !this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    
    // Set default timeout and URL
    const timeout = options?.timeout || 30000;
    const loginUrl = options?.url || 'https://accounts.google.com/';
    
    try {
      console.log(`Navigating to ${loginUrl}`);
      await this.takeScreenshot('before_navigation');
      
      // Go to login page with realistic behavior
      await this.page.goto(loginUrl, {
        waitUntil: 'domcontentloaded', // Wait just for DOM content, like a real user
        timeout: 15000 // Real browsers don't wait forever
      });
      
      // Wait for page to start loading (humans can't interact immediately)
      await this.humanWait(500, 1500);
      
      // After initial wait, take a screenshot
      await this.takeScreenshot('after_navigation');
      
      // Before critical interactions, perform natural exploration
      // This is critical - humans don't immediately start typing or clicking
      await this.simulateNaturalExploration();
      
      // Wait for page to stabilize after exploration
      await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        console.log('Page did not reach network idle, but continuing like a human would...');
      });
      
      // Check for account rejection/challenges before proceeding
      const isChallenged = await this.handleChallengePage();
      if (isChallenged) {
        return {
          success: false,
          error: 'Account security challenge detected',
          errorCode: 'SECURITY_CHALLENGE',
          message: 'Google has detected suspicious activity and presented a challenge we cannot complete automatically'
        };
      }
      
      // Handle landing pages by detecting and clicking "Sign in" buttons
      const initialUrl = this.page.url();
      const pageTitle = await this.page.title();
      console.log(`Current page: "${pageTitle}", URL: ${initialUrl}`);
      
      // Check if we're on a landing page (not the login page)
      if ((initialUrl.includes('business.google.com') || initialUrl.includes('google.com/business')) && 
          !initialUrl.includes('accounts.google.com') && 
          !initialUrl.includes('signin')) {
        console.log('On Google Business landing page, looking for Sign in button...');
        await this.takeScreenshot('business_landing_page');
        
        // Before clicking, simulate a human exploring the page
        await this.simulateNaturalExploration();
        
        // Try multiple approaches to find and click the sign in button
        try {
          // Try common sign in button selectors
          const signInSelectors = [
            'a:has-text("Sign in")',
            'button:has-text("Sign in")',
            'a:has-text("Log in")',
            'button:has-text("Log in")', 
            '[data-target="signin"]',
            '.signin',
            '.sign-in',
            'a[href*="accounts.google.com"]',
            'a[href*="signin"]'
          ];
          
          let buttonClicked = false;
          for (const selector of signInSelectors) {
            const button = this.page.locator(selector);
            if (await button.count() > 0) {
              console.log(`Found sign in button with selector: ${selector}`);
              
              // First move the mouse to the button in a human-like way
              const buttonHandle = await button.elementHandle();
              if (buttonHandle) {
                await this.simulateHumanMouseMovement(buttonHandle);
                // Pause briefly as if making a decision before clicking (humans do this)
                await this.humanWait(200, 800);
                await buttonHandle.click({ delay: Math.floor(Math.random() * 100) + 30 });
                buttonClicked = true;
                break;
              }
            }
          }
          
          if (!buttonClicked) {
            console.log('Fallback: Trying to navigate directly to accounts.google.com');
            // Fallback to direct navigation if no button found
            await this.page.goto('https://accounts.google.com/ServiceLogin', { 
              waitUntil: 'domcontentloaded',
              timeout: 15000
            });
          }
          
          // Wait for navigation and stabilization
          await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          await this.takeScreenshot('after_signin_click');
          
          // Check for challenges after clicking sign-in
          const isChallengedAfterClick = await this.handleChallengePage();
          if (isChallengedAfterClick) {
            return {
              success: false,
              error: 'Account security challenge detected after sign-in button',
              errorCode: 'SECURITY_CHALLENGE',
              message: 'Google presented a security challenge after clicking sign-in'
            };
          }
        } catch (buttonError) {
          console.warn('Error finding/clicking sign in button:', buttonError);
          // Fallback to direct navigation
          await this.page.goto('https://accounts.google.com/ServiceLogin', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          });
          await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        }
      }
      
      // Check for account chooser
      const hasAccountChooser = await this.page.locator('.OVnw0d').count() > 0;
      
      if (hasAccountChooser) {
        console.log('Account chooser detected, selecting "Use another account"');
        await this.takeScreenshot('account_chooser');
        
        // Before interacting, perform some natural exploration on the account chooser page
        await this.simulateNaturalExploration();
        
        // Click on "Use another account" option with human-like behavior
        const useAnotherAccountButton = this.page.getByText('Use another account') || 
                                         this.page.getByText('Use another');
        
        if (await useAnotherAccountButton.count() > 0) {
          const buttonHandle = await useAnotherAccountButton.elementHandle();
          if (buttonHandle) {
            await this.simulateHumanMouseMovement(buttonHandle);
            await this.humanWait(300, 800); // Brief pause before clicking
            await buttonHandle.click({ delay: Math.floor(Math.random() * 100) + 30 });
          }
        } else {
          // If "Use another account" is not found, try to click on add account button
          const addAccountButton = this.page.locator('.BHzsHc');
          if (await addAccountButton.count() > 0) {
            const buttonHandle = await addAccountButton.elementHandle();
            if (buttonHandle) {
              await this.simulateHumanMouseMovement(buttonHandle);
              await this.humanWait(300, 800);
              await buttonHandle.click({ delay: Math.floor(Math.random() * 100) + 30 });
            }
          }
        }
        
        // Wait longer for navigation after account selection
        await this.humanWait(2000, 3500);
      }
      
      // Wait for email input with proper error handling
      console.log('Waiting for email input field...');
      try {
        // Take a screenshot to show what page we're on
        await this.takeScreenshot('before_email_input_search');
        
        // Try multiple selectors for email input
        const emailInputSelectors = [
          'input[type="email"]', 
          '#identifierId', 
          'input[name="identifier"]',
          'input[name="Email"]',
          'input[aria-label="Email or phone"]',
          'input[placeholder*="Email"]',
          'input[placeholder*="email"]'
        ];
        
        // Try each selector individually instead of combining them for better error diagnosis
        let emailInput = null;
        let foundSelector = '';
        
        for (const selector of emailInputSelectors) {
          const el = this.page.locator(selector);
          if (await el.count() > 0) {
            console.log(`Found email input with selector: ${selector}`);
            emailInput = el;
            foundSelector = selector;
            break;
          }
        }
        
        if (!emailInput) {
          // If not found, try the "search entire page" approach
          console.log('Email input not found with standard selectors, scanning all input elements...');
          
          // Get all input elements and check each one
          const allInputs = this.page.locator('input');
          const count = await allInputs.count();
          
          for (let i = 0; i < count; i++) {
            const input = allInputs.nth(i);
            const type = await input.getAttribute('type') || '';
            const name = await input.getAttribute('name') || '';
            const placeholder = await input.getAttribute('placeholder') || '';
            const ariaLabel = await input.getAttribute('aria-label') || '';
            
            console.log(`Input #${i}: type=${type}, name=${name}, placeholder=${placeholder}, aria-label=${ariaLabel}`);
            
            if (type === 'email' || 
                name.toLowerCase().includes('email') || 
                name === 'identifier' || 
                placeholder.toLowerCase().includes('email') ||
                ariaLabel.toLowerCase().includes('email')) {
              emailInput = input;
              foundSelector = `Input #${i}`;
              break;
            }
          }
        }
        
        if (emailInput) {
          console.log(`Using email input found with: ${foundSelector}`);
          await emailInput.waitFor({ timeout });
        } else {
          throw new Error('Email input not found after exhaustive search');
        }
      } catch (error) {
        console.warn('Could not find email input with any selectors, trying alternatives...');
        
        // Try different approaches if the main one fails
        const pageTitle = await this.page.title();
        const pageUrl = this.page.url();
        
        await this.takeScreenshot('email_input_not_found');
        console.log(`Current page title: "${pageTitle}", URL: ${pageUrl}`);
        
        // Check if we're on a different page than expected
        if (pageUrl.includes('myaccount.google.com') || pageTitle.includes('Google Account')) {
          console.log('Already logged in or on account page');
          return { 
            success: true, 
            message: 'Already logged in to Google account'
          };
        }
        
        // Try one last direct navigation to a known-good URL
        console.log('Last attempt: Navigating directly to accounts.google.com/ServiceLogin');
        await this.page.goto('https://accounts.google.com/ServiceLogin');
        await this.page.waitForLoadState('networkidle').catch(() => {});
        await this.takeScreenshot('final_attempt');
        
        // Check if we have the email input now
        const finalEmailInput = this.page.locator('input[type="email"], #identifierId');
        if (await finalEmailInput.count() > 0) {
          console.log('Found email input after final redirect!');
        } else {
          throw new Error(`Email input not found after multiple attempts. Page title: "${pageTitle}", URL: ${pageUrl}`);
        }
      }
      
      // Enter email with human-like typing
      console.log('Entering email address...');
      await this.takeScreenshot('before_email');
      
      // Find the email input again - use all possible selectors for maximum reliability
      const emailInput = this.page.locator([
        'input[type="email"]', 
        '#identifierId', 
        'input[name="identifier"]',
        'input[name="Email"]',
        'input[aria-label="Email or phone"]',
        'input[placeholder*="Email"]',
        'input[placeholder*="email"]'
      ].join(','));
      
      // Before typing, move the mouse in a human-like way
      await this.simulateHumanMouseMovement(emailInput);
      
      // Click with a natural delay
      await emailInput.click({ delay: Math.floor(Math.random() * 100) + 50 });
      await emailInput.clear(); // Clear any existing content
      
      // Pause briefly after clicking, as humans do
      await this.page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
      
      // Advanced human typing simulation with potential errors
      await this.simulateHumanTyping(credentials.email);
      
      // Maybe select the text and review it (as a human would)
      if (Math.random() < 0.2) {
        // Select all text randomly
        await emailInput.click({ clickCount: 3 }); // Triple click to select all
        await this.page.waitForTimeout(Math.floor(Math.random() * 500) + 200);
        // Decide not to change it and click away to deselect
        await this.page.mouse.click(
          10, 10, 
          { delay: Math.floor(Math.random() * 100) + 30 }
        );
        // Click back in the input
        await this.simulateHumanMouseMovement(emailInput);
        await emailInput.click({ delay: Math.floor(Math.random() * 80) + 30 });
      }
      
      await this.takeScreenshot('after_email');
      
      // Click next button while avoiding "Forgot email"
      console.log('Looking for Next button...');
      
      // First check if "Forgot email" button exists to avoid it
      const forgotEmailButton = this.page.getByText('Forgot email').or(this.page.getByText('Find your email'));
      const hasForgotEmail = await forgotEmailButton.count() > 0;
      
      if (hasForgotEmail) {
        console.log('⚠️ "Forgot email" button detected, carefully selecting Next button');
        await this.takeScreenshot('forgot_email_warning');
        
        // Use most specific selector for Next button when "Forgot email" is present
        try {
          // First approach: Click the identifierNext container (contains the button)
          const nextContainer = this.page.locator('#identifierNext');
          if (await nextContainer.count() > 0) {
            // First move the mouse to the button in a human-like way
            await this.simulateHumanMouseMovement(nextContainer);
            
            // Then click with delay
            await nextContainer.click({ delay: Math.floor(Math.random() * 100) + 50 });
          } else {
            // Second approach: Look for the "Next" button specifically
            // Only click buttons containing "Next" but avoid "Forgot"/"Find" buttons
            console.log('Looking for specific Next button');
            const buttons = this.page.locator('button');
            const buttonCount = await buttons.count();
            
            // Log all button text for debugging
            for (let i = 0; i < buttonCount; i++) {
              const buttonText = await buttons.nth(i).textContent() || '';
              console.log(`Button ${i}: "${buttonText}"`);
            }
            
            let nextButtonFound = false;
            for (let i = 0; i < buttonCount; i++) {
              const button = buttons.nth(i);
              const text = await button.textContent() || '';
              if (text.includes('Next') && !text.includes('Forgot') && !text.includes('Find')) {
                console.log(`Clicking Next button: "${text}"`);
                await this.simulateHumanMouseMovement(button);
                await button.click({ delay: Math.floor(Math.random() * 100) + 50 });
                nextButtonFound = true;
                break;
              }
            }
            
            // Third approach: Try clicking any visible submit button
            if (!nextButtonFound) {
              console.log('Trying to find submit button');
              const submitButton = this.page.locator('button[type="submit"]');
              if (await submitButton.count() > 0) {
                await this.simulateHumanMouseMovement(submitButton);
                await submitButton.click({ delay: Math.floor(Math.random() * 100) + 50 });
              }
            }
          }
        } catch (nextError) {
          console.warn('Error finding Next button:', nextError);
        }
      } else {
        // No "Forgot email" button, use normal approach with human mouse movement
        const nextButton = this.page.getByRole('button', { name: 'Next' })
          .or(this.page.locator('#identifierNext'))
          .or(this.page.locator('button[type="submit"]'));
          
        // Use human-like mouse movement and clicking
        await this.simulateHumanMouseMovement(nextButton);
        
        // Add random pause before clicking (humans don't click instantly)
        await this.page.waitForTimeout(Math.floor(Math.random() * 300) + 100);
        
        // Click with human-like delay
        await nextButton.click({ delay: Math.floor(Math.random() * 100) + 50 });
      }
      
      await this.takeScreenshot('after_next_button');
      await this.page.waitForTimeout(2000);
      
      // Add explicit wait after clicking next button
      console.log('Waiting after Next button click to allow page transition...');
      await this.humanWait(4000, 7000); // More significant wait to ensure page transition
      
      // Take a screenshot after waiting period to see what happened
      await this.takeScreenshot('after_next_button_wait');
      
      // Verify we didn't go to "Find your email" page
      const currentUrl = this.page.url();
      if (currentUrl.includes('accountrecovery') || currentUrl.includes('recovery')) {
        console.error('ERROR: Accidentally navigated to "Find your email" page');
        await this.takeScreenshot('recovery_page_error');
        return {
          success: false,
          error: 'Accidentally navigated to account recovery',
          errorCode: 'RECOVERY_PAGE_ERROR',
          message: 'Browser automation clicked "Forgot email" instead of "Next"'
        };
      }
      
      // Check if we're still on the email page - could indicate Next button wasn't clicked properly
      if (currentUrl.includes('identifier') && await this.page.locator('input[type="email"]').count() > 0) {
        console.log('Still on email input page - attempting to click Next button again');
        
        // Try alternative Next button approaches
        try {
          // Try a direct XPath approach to the Next button
          const nextButtonByRole = this.page.locator('button[type="button"][jsname="Cuz2Ue"]');
          
          if (await nextButtonByRole.count() > 0) {
            console.log('Found Next button by jsname attribute');
            await nextButtonByRole.click({ delay: Math.floor(Math.random() * 100) + 50 });
            await this.humanWait(3000, 5000);
          } else {
            // Try a different approach - content-based
            const buttonWithNext = this.page.locator('button:has-text("Next")');
            if (await buttonWithNext.count() > 0) {
              console.log('Found Next button via text content');
              await buttonWithNext.click({ delay: Math.floor(Math.random() * 100) + 50 });
              await this.humanWait(3000, 5000);
            } else {
              console.log('Unable to find Next button in second attempt');
            }
          }
          
          // Take another screenshot after second attempt
          await this.takeScreenshot('after_next_second_attempt');
        } catch (retryError) {
          console.warn('Error in retry click:', retryError);
        }
      }
      
      // Wait for password field
      console.log('Waiting for password field...');
      try {
        const passwordInput = this.page.locator('input[type="password"], input[name="password"]');
        
        // Use a more robust wait approach with retry
        let passwordFound = false;
        for (let attempt = 1; attempt <= 3 && !passwordFound; attempt++) {
          console.log(`Password field attempt ${attempt}/3`);
          
          try {
            // Try to wait for password field with shorter timeout per attempt
            await passwordInput.waitFor({ timeout: timeout / 3 });
            passwordFound = true;
            console.log('Password field found!');
          } catch (attemptError) {
            // If we're still on the email screen, we might need to click Next again
            if (await this.page.locator('input[type="email"]').count() > 0) {
              console.log(`Still on email screen in attempt ${attempt}, trying another Next button approach`);
              
              // Try a different strategy on each attempt
              if (attempt === 1) {
                await this.page.locator('#identifierNext').click().catch(() => {});
              } else if (attempt === 2) {
                await this.page.keyboard.press('Enter');
              } else {
                // Third approach - find any button that might be the Next button
                const buttons = await this.page.$$('button');
                for (const button of buttons) {
                  const isVisible = await button.isVisible();
                  if (isVisible) {
                    await this.simulateHumanMouseMovement(button);
                    await button.click().catch(() => {});
                    break;
                  }
                }
              }
              await this.humanWait(3000, 5000);
            }
          }
        }
        
        if (!passwordFound) {
          throw new Error('Password field not found after multiple attempts');
        }
      } catch (pwdError) {
        // Check for common error conditions
        const pageText = await this.page.evaluate(() => document.body.innerText);
        
        await this.takeScreenshot('password_field_not_found');
        
        // Check for different error states
        if (pageText.includes('Find your email') || pageText.includes('couldn\'t find your Google Account')) {
          return {
            success: false,
            error: 'Email not found',
            errorCode: 'EMAIL_NOT_FOUND',
            message: 'Google couldn\'t find an account with this email address'
          };
        } else if (pageText.includes('unusual activity') || pageText.includes('suspicious')) {
          return {
            success: false,
            error: 'Suspicious activity',
            errorCode: 'SUSPICIOUS_ACTIVITY',
            message: 'Google detected unusual activity on this account'
          };
        } else if (pageText.includes('verify') || pageText.includes('confirm it\'s you')) {
          return {
            success: false,
            error: 'Verification required',
            errorCode: 'VERIFICATION_REQUIRED',
            message: 'Google requires additional verification that automation cannot complete'
          };
        }
        
        throw new Error(`Password field not found. Current URL: ${currentUrl}`);
      }
      
      // Enter password
      console.log('Entering password...');
      await this.takeScreenshot('before_password');
      
      // Find password input and type with random delays
      const passwordInput = this.page.locator('input[type="password"]');
      await passwordInput.click();
      
      for (const char of credentials.password) {
        await this.page.keyboard.type(char, { delay: Math.floor(Math.random() * 100) + 50 });
      }
      
      await this.takeScreenshot('after_password');
      
      // Click sign in button
      console.log('Clicking password submit button...');
      const signInButton = this.page.getByRole('button', { name: 'Next' })
        .or(this.page.getByText('Sign in'))
        .or(this.page.locator('#passwordNext'));
      
      await signInButton.click();
      
      await this.takeScreenshot('after_signin');
      await this.page.waitForTimeout(3000);
      
      // Check for success and possible 2FA or other challenges
      const successUrl = this.page.url();
      console.log(`Current URL after sign in: ${successUrl}`);
      
      // Check for common error situations
      const wrongPasswordText = this.page.getByText('Wrong password');
      if (await wrongPasswordText.count() > 0) {
        await this.takeScreenshot('wrong_password');
        return {
          success: false,
          error: 'Wrong password',
          errorCode: 'WRONG_PASSWORD',
          message: 'The password entered for this Google account is incorrect'
        };
      }
      
      // Check for 2FA challenge
      const twoFactorText = this.page.getByText('2-Step Verification');
      if (successUrl.includes('challenge') || await twoFactorText.count() > 0) {
        await this.takeScreenshot('2fa_challenge');
        return {
          success: false,
          error: '2FA required',
          errorCode: 'TWO_FACTOR_REQUIRED',
          message: 'Two-factor authentication is required for this account'
        };
      }
      
      // Check for successful login
      if (successUrl.includes('myaccount.google.com') || 
          successUrl.includes('accounts.google.com/signin/v2/challenge/selection') ||
          successUrl.includes('business.google.com')) {
        await this.takeScreenshot('login_success');
        return {
          success: true,
          message: 'Successfully authenticated with Google'
        };
      }
      
      // Final check - take a screenshot but assume success if no specific errors detected
      await this.takeScreenshot('final_state');
      return {
        success: true,
        message: 'Authentication completed'
      };
    } catch (error) {
      console.error('Google authentication error:', error);
      await this.takeScreenshot('auth_error');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'AUTH_ERROR',
        message: 'Failed to authenticate with Google'
      };
    }
  }
  
  /**
   * Close the browser session
   */
  public async close(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
      }
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }
}

/**
 * Create a pre-configured GoogleAuthenticator instance
 */
export async function createGoogleAuthenticator(options?: { 
  screenshotsDir?: string 
}): Promise<GoogleAuthenticator> {
  const authenticator = new GoogleAuthenticator(options);
  await authenticator.initialize();
  return authenticator;
}

/**
 * Simple utility function for one-off Google authentication
 */
export async function authenticateGoogle(
  credentials: GoogleCredentials,
  options?: { url?: string, timeout?: number, screenshotsDir?: string }
): Promise<AuthResult> {
  const authenticator = await createGoogleAuthenticator({
    screenshotsDir: options?.screenshotsDir
  });
  
  try {
    return await authenticator.authenticateGoogle(credentials, {
      url: options?.url,
      timeout: options?.timeout
    });
  } finally {
    await authenticator.close();
  }
}