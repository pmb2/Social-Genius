/**
 * Browser Instance Manager with Redis Integration
 * 
 * Manages Playwright browser instances with browser automation integration 
 * for automated browser interactions using Playwright directly or with optional 
 * automation frameworks like Agno (Python) or Motia (JavaScript).
 * 
 * This enhanced version integrates with Redis for session sharing across services.
 */

// Only import types, not the actual implementations
import type { Browser, BrowserContext, Page } from 'playwright';
import { AgnoAgent } from './agno-agent';
import RedisSessionManager, { BrowserSessionData } from './redis-session-manager';

// Check if we're running on the server
const isServer = typeof window === 'undefined';

// Create client-side stubs if we're in the browser
// This prevents Next.js from trying to bundle Playwright for client-side
class ClientSideBrowserInstance {
  getInstanceCount() { return 0; }
  getActiveInstanceCount() { return 0; }
  async getOrCreateInstance() { 
    console.warn('Browser automation is not available in the browser');
    return 'stub-instance'; 
  }
  async instanceExists() { return false; }
  async activateInstance() { return; }
  async getInstanceComponents() { 
    throw new Error('Browser automation is not available in the browser'); 
  }
  updateInstanceActivity() { return; }
  async removeInstance() { return false; }
  async shutdown() { return; }
}

// Type for browser instance storage
interface BrowserInstance {
  browser: Browser;        // Playwright browser instance
  context: BrowserContext; // Playwright browser context
  page: Page;              // Playwright page
  agno: AgnoAgent;         // Browser automation agent
  lastUsed: Date;          // Timestamp of last activity
  active: boolean;         // Whether the instance is currently active
  sessionId?: string;      // Redis session ID for persistence
}

// Extended instance manager with Redis integration
class ServerBrowserInstanceManager {
  private instances: Map<string, BrowserInstance> = new Map();
  private expirationCheckInterval: NodeJS.Timeout | null = null;
  private readonly instanceTTL = 30 * 60 * 1000; // 30 minutes in milliseconds
  private sessionManager: typeof RedisSessionManager;
  private isInitialized = false;
  
  constructor() {
    // Initialize Redis session manager
    this.sessionManager = RedisSessionManager;
    
    // Start the expiration check interval
    this.expirationCheckInterval = setInterval(() => {
      this.cleanupExpiredInstances();
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    // Handle process exit
    process.on('beforeExit', () => {
      this.shutdown();
    });

    // Log initialization
    console.log('[BrowserInstanceManager] Initialized with Redis session integration');
  }

  /**
   * Initialize the manager and load any persisted sessions
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[BrowserInstanceManager] Loading active sessions from Redis');
      
      // Search for active sessions
      const activeSessions = await this.sessionManager.searchSessions({
        status: 'active',
        limit: 100 // Limit the number of sessions to load initially
      });

      console.log(`[BrowserInstanceManager] Found ${activeSessions.length} active sessions in Redis`);
      
      // We don't create browser instances here, just register them as inactive
      // They'll be activated on demand when requested
      for (const session of activeSessions) {
        this.registerPersistedSession(session);
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('[BrowserInstanceManager] Error initializing from Redis:', error);
      
      // Continue without Redis sessions
      this.isInitialized = true;
    }
  }

  /**
   * Register a persisted session from Redis without creating a browser instance yet
   */
  private registerPersistedSession(session: BrowserSessionData): void {
    const key = session.businessId;
    
    // Don't create the actual browser instance yet, just register it as inactive
    this.instances.set(key, {
      browser: null as any,
      context: null as any,
      page: null as any,
      agno: null as any,
      lastUsed: new Date(session.lastUsed),
      active: false,
      sessionId: session.id
    });

    console.log(`[BrowserInstanceManager] Registered persisted session ${session.id} for business ${key} (inactive)`);
  }
  
  /**
   * Get or create a browser instance for the given key
   */
  public async getOrCreateInstance(key: string): Promise<string> {
    // Ensure we're initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If instance already exists, return its key
    if (this.instances.has(key)) {
      // Update last used timestamp
      const instance = this.instances.get(key)!;
      instance.lastUsed = new Date();
      
      // Update the session in Redis
      if (instance.sessionId) {
        await this.sessionManager.updateSession(instance.sessionId, {
          lastUsed: instance.lastUsed.toISOString()
        });
      }
      
      // Activate if not active
      if (!instance.active) {
        await this.activateInstance(key);
      }
      
      return key;
    }
    
    // Only create browser instances on the server side
    if (typeof window !== 'undefined') {
      console.warn('Browser automation is only supported on the server side');
      throw new Error('Browser automation is not supported in browser environments');
    }
    
    // Create a new instance
    try {
      // Import Playwright dynamically to prevent server-side issues
      let chromium;
      try {
        const playwright = await import('playwright');
        chromium = playwright.chromium;
      } catch (error) {
        console.error('Failed to import playwright:', error);
        throw new Error('Failed to load browser automation dependencies');
      }
      
      // Launch browser with appropriate options
      const browser = await chromium.launch({
        headless: true, // Use headless browser in production
      });
      
      // Create browser context with realistic user agent and viewport
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });
      
      // Create new page
      const page = await context.newPage();
      
      // Create Agno agent for the page
      const agno = new AgnoAgent(page);

      // Create browser instance
      const now = new Date();
      
      // Create a Redis session
      const session = await this.sessionManager.createSession({
        businessId: key,
        email: 'auto-created@example.com', // Placeholder value
        status: 'active',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        metadata: {
          createdBy: 'BrowserInstanceManager',
          process: process.pid,
        }
      });
      
      // Store the new instance
      this.instances.set(key, {
        browser,
        context,
        page,
        agno,
        lastUsed: now,
        active: true,
        sessionId: session.id
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BrowserInstanceManager] Created new browser instance for key: ${key}, session ID: ${session.id}`);
      }
      return key;
    } catch (error) {
      console.error(`[BrowserInstanceManager] Error creating browser instance for key ${key}:`, error);
      throw new Error(`Failed to create browser instance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if a browser instance exists
   */
  public async instanceExists(key: string): Promise<boolean> {
    // Ensure we're initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Check local cache first
    if (this.instances.has(key)) {
      return true;
    }
    
    // Check Redis for a session with this business ID
    try {
      const session = await this.sessionManager.getActiveSession(key);
      if (session) {
        // Register the persisted session but don't activate it yet
        this.registerPersistedSession(session);
        return true;
      }
    } catch (error) {
      console.error(`[BrowserInstanceManager] Error checking Redis for session with key ${key}:`, error);
    }
    
    return false;
  }
  
  /**
   * Activate a browser instance (wake it from hibernation if needed)
   */
  public async activateInstance(key: string): Promise<void> {
    // Ensure we're initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const instance = this.instances.get(key);
    if (!instance) {
      throw new Error(`Browser instance not found for key: ${key}`);
    }
    
    // If instance is already active, just update the timestamp
    if (instance.active) {
      instance.lastUsed = new Date();
      
      // Update the session in Redis
      if (instance.sessionId) {
        await this.sessionManager.updateSession(instance.sessionId, {
          lastUsed: instance.lastUsed.toISOString()
        });
      }
      return;
    }
    
    // Try to load session data from Redis for the hibernated instance
    let cookies = null;
    let storageData = null;
    
    if (instance.sessionId) {
      try {
        const session = await this.sessionManager.getSession(instance.sessionId);
        if (session && session.cookiesJson) {
          cookies = JSON.parse(session.cookiesJson);
        }
        if (session && session.storageJson) {
          storageData = JSON.parse(session.storageJson);
        }
      } catch (error) {
        console.error(`[BrowserInstanceManager] Error loading session data for ${key}:`, error);
      }
    }
    
    // If instance is hibernated, we need to recreate it
    // Only create browser instances on the server side
    if (typeof window !== 'undefined') {
      console.warn('Browser automation is only supported on the server side');
      throw new Error('Browser automation is not supported in browser environments');
    }
    
    try {
      // Import Playwright dynamically
      let chromium;
      try {
        const playwright = await import('playwright');
        chromium = playwright.chromium;
      } catch (error) {
        console.error('Failed to import playwright:', error);
        throw new Error('Failed to load browser automation dependencies');
      }
      
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
      
      // Restore cookies if available
      if (cookies) {
        await context.addCookies(cookies);
        console.log(`[BrowserInstanceManager] Restored ${cookies.length} cookies for key: ${key}`);
      }
      
      // Create new page
      const page = await context.newPage();
      
      // Restore storage if available
      if (storageData) {
        if (storageData.localStorage) {
          await page.evaluate((data) => {
            for (const [key, value] of Object.entries(data)) {
              localStorage.setItem(key, value as string);
            }
          }, storageData.localStorage);
        }
        
        if (storageData.sessionStorage) {
          await page.evaluate((data) => {
            for (const [key, value] of Object.entries(data)) {
              sessionStorage.setItem(key, value as string);
            }
          }, storageData.sessionStorage);
        }
        
        console.log(`[BrowserInstanceManager] Restored storage data for key: ${key}`);
      }
      
      // Create new Agno agent
      const agno = new AgnoAgent(page);
      
      // Update the instance
      instance.browser = browser;
      instance.context = context;
      instance.page = page;
      instance.agno = agno;
      instance.lastUsed = new Date();
      instance.active = true;
      
      // Update the session in Redis
      if (instance.sessionId) {
        await this.sessionManager.updateSession(instance.sessionId, {
          lastUsed: instance.lastUsed.toISOString(),
          status: 'active'
        });
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BrowserInstanceManager] Re-activated browser instance for key: ${key}`);
      }
    } catch (error) {
      console.error(`[BrowserInstanceManager] Error re-activating browser instance for key ${key}:`, error);
      throw new Error(`Failed to re-activate browser instance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get Playwright and Agno components for a browser instance
   */
  public async getInstanceComponents(key: string): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    agno: AgnoAgent;
  }> {
    // Ensure we're initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
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
      agno: instance.agno
    };
  }
  
  /**
   * Update the last activity timestamp for an instance
   */
  public updateInstanceActivity(key: string): void {
    const instance = this.instances.get(key);
    if (instance) {
      instance.lastUsed = new Date();
      
      // Update the session in Redis asynchronously
      if (instance.sessionId) {
        this.sessionManager.updateSession(instance.sessionId, {
          lastUsed: instance.lastUsed.toISOString()
        }).catch(error => {
          console.error(`[BrowserInstanceManager] Error updating session activity for ${key}:`, error);
        });
      }
    }
  }
  
  /**
   * Hibernate a browser instance to save resources
   * This closes the browser but keeps the instance record and preserves session in Redis
   */
  private async hibernateInstance(key: string): Promise<void> {
    const instance = this.instances.get(key);
    if (!instance || !instance.active) {
      return;
    }
    
    try {
      // Save cookies and storage to Redis before closing
      if (instance.sessionId) {
        try {
          // Get cookies
          const cookies = await instance.context.cookies();
          
          // Get storage (localStorage and sessionStorage)
          const localStorage = await instance.page.evaluate(() => {
            const items = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              items[key] = localStorage.getItem(key);
            }
            return items;
          });
          
          const sessionStorage = await instance.page.evaluate(() => {
            const items = {};
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              items[key] = sessionStorage.getItem(key);
            }
            return items;
          });
          
          // Update session in Redis with cookies and storage data
          await this.sessionManager.updateSession(instance.sessionId, {
            cookiesJson: JSON.stringify(cookies),
            storageJson: JSON.stringify({ localStorage, sessionStorage }),
            lastUsed: new Date().toISOString()
          });
          
          console.log(`[BrowserInstanceManager] Saved session data to Redis for key: ${key}`);
        } catch (sessionError) {
          console.error(`[BrowserInstanceManager] Error saving session data for ${key}:`, sessionError);
        }
      }
      
      // Close the browser
      await instance.browser.close();
      
      // Mark as inactive
      instance.active = false;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BrowserInstanceManager] Hibernated browser instance for key: ${key}`);
      }
    } catch (error) {
      console.error(`[BrowserInstanceManager] Error hibernating browser instance for key ${key}:`, error);
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
      
      // Delete the session from Redis if we have a session ID
      if (instance.sessionId) {
        try {
          await this.sessionManager.deleteSession(instance.sessionId);
          console.log(`[BrowserInstanceManager] Deleted Redis session ${instance.sessionId} for key: ${key}`);
        } catch (sessionError) {
          console.error(`[BrowserInstanceManager] Error deleting Redis session for ${key}:`, sessionError);
        }
      }
      
      // Remove from the map
      this.instances.delete(key);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BrowserInstanceManager] Removed browser instance for key: ${key}`);
      }
      return true;
    } catch (error) {
      console.error(`[BrowserInstanceManager] Error removing browser instance for key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Clean up expired instances
   */
  private async cleanupExpiredInstances(): Promise<void> {
    // Ensure we're initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    console.log('[BrowserInstanceManager] Running expired instance cleanup...');
    
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
    
    // Also clean up expired sessions in Redis
    try {
      await this.sessionManager.expireInactiveSessions(this.instanceTTL * 2);
      await this.sessionManager.cleanupExpiredSessions();
    } catch (redisError) {
      console.error('[BrowserInstanceManager] Error cleaning up Redis sessions:', redisError);
    }
  }
  
  /**
   * Shutdown all browser instances
   */
  public async shutdown(): Promise<void> {
    console.log('[BrowserInstanceManager] Shutting down all browser instances...');
    
    // Clear the interval
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }
    
    // Close all browsers and save session data to Redis
    for (const [key, instance] of this.instances.entries()) {
      if (instance.active) {
        try {
          // Save session data before closing
          if (instance.sessionId) {
            try {
              // Get cookies
              const cookies = await instance.context.cookies();
              
              // Get storage (localStorage and sessionStorage)
              const localStorage = await instance.page.evaluate(() => {
                const items = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  items[key] = localStorage.getItem(key);
                }
                return items;
              });
              
              const sessionStorage = await instance.page.evaluate(() => {
                const items = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                  const key = sessionStorage.key(i);
                  items[key] = sessionStorage.getItem(key);
                }
                return items;
              });
              
              // Update session in Redis with cookies and storage data
              await this.sessionManager.updateSession(instance.sessionId, {
                cookiesJson: JSON.stringify(cookies),
                storageJson: JSON.stringify({ localStorage, sessionStorage }),
                lastUsed: new Date().toISOString()
              });
              
              console.log(`[BrowserInstanceManager] Saved session data to Redis for key: ${key} during shutdown`);
            } catch (sessionError) {
              console.error(`[BrowserInstanceManager] Error saving session data for ${key} during shutdown:`, sessionError);
            }
          }
          
          // Close the browser
          await instance.browser.close();
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`[BrowserInstanceManager] Closed browser instance for key: ${key}`);
          }
        } catch (error) {
          console.error(`[BrowserInstanceManager] Error closing browser instance for key ${key}:`, error);
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
  
  /**
   * Get debugging information about instances and Redis
   */
  public async getDebugInfo(): Promise<any> {
    // Get Redis debug info
    let redisInfo;
    try {
      redisInfo = await this.sessionManager.getDebugInfo();
    } catch (error) {
      redisInfo = { error: error instanceof Error ? error.message : String(error) };
    }
    
    // Get instance info
    const instanceInfo = Array.from(this.instances.entries()).map(([key, instance]) => ({
      key,
      active: instance.active,
      lastUsed: instance.lastUsed,
      sessionId: instance.sessionId,
      ageMs: new Date().getTime() - instance.lastUsed.getTime()
    }));
    
    return {
      instances: {
        total: this.instances.size,
        active: this.getActiveInstanceCount(),
        details: instanceInfo
      },
      redis: redisInfo,
      initialized: this.isInitialized
    };
  }
}

// Export the appropriate class based on environment
export const BrowserInstanceManager = isServer ? ServerBrowserInstanceManager : ClientSideBrowserInstance;