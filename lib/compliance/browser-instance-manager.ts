/**
 * Browser Instance Manager
 * 
 * Manages Playwright browser instances with browser automation integration 
 * for automated browser interactions using Playwright directly or with optional 
 * automation frameworks like Agno (Python) or Motia (JavaScript).
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import { AgnoAgent } from './agno-agent';

// Type for browser instance storage
interface BrowserInstance {
  browser: Browser;        // Playwright browser instance
  context: BrowserContext; // Playwright browser context
  page: Page;              // Playwright page
  agno: AgnoAgent;         // Browser automation agent
  lastUsed: Date;          // Timestamp of last activity
  active: boolean;         // Whether the instance is currently active
}

export class BrowserInstanceManager {
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
      
      // Store the new instance
      this.instances.set(key, {
        browser,
        context,
        page,
        agno,
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
      
      // Create new Agno agent
      const agno = new AgnoAgent(page);
      
      // Update the instance
      instance.browser = browser;
      instance.context = context;
      instance.page = page;
      instance.agno = agno;
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
   * Get Playwright and Agno components for a browser instance
   */
  public async getInstanceComponents(key: string): Promise<{
    browser: Browser;
    context: BrowserContext;
    page: Page;
    agno: AgnoAgent;
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