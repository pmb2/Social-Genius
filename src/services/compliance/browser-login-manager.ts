/**
 * Browser Login Manager
 * 
 * This module integrates the Google login sequence with the browser instance manager
 * and Redis session management to provide a comprehensive login system for Google Business Profile.
 */

import type { BrowserContext, Page } from 'playwright';
import { BrowserInstanceManager } from './browser-instance-manager';
import RedisSessionManager from './redis-session-manager';
import { executeGoogleLogin, LoginConfig, LoginResult, ChallengeType } from '@/lib/browser-automation/login-sequence';
import { createError, ErrorCodes, ErrorRetry } from '@/lib/error-types';
import { v4 as uuidv4 } from 'uuid';

// Authentication request interface
export interface AuthRequest {
  businessId: string;
  email: string;
  password: string;  // This should be pre-decrypted
  instanceId?: string;
  traceId?: string;
  options?: {
    humanEmulation?: boolean;
    timeout?: number;
    maxRetries?: number;
    reuseSession?: boolean;
    screenshotPath?: string;
  };
}

// Authentication result interface
export interface AuthResult {
  success: boolean;
  businessId: string;
  email: string;
  instanceId: string;
  sessionId?: string;
  errorCode?: string;
  errorMessage?: string;
  challenge?: string;
  traceId: string;
  timestamp: string;
  metadata?: any;
}

/**
 * Browser Login Manager for Google authentication
 */
export class BrowserLoginManager {
  private browserManager: BrowserInstanceManager;
  private sessionManager: typeof RedisSessionManager;
  private static instance: BrowserLoginManager;
  
  /**
   * Get the singleton instance of BrowserLoginManager
   */
  public static getInstance(): BrowserLoginManager {
    if (!BrowserLoginManager.instance) {
      BrowserLoginManager.instance = new BrowserLoginManager();
    }
    return BrowserLoginManager.instance;
  }
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.browserManager = new BrowserInstanceManager();
    this.sessionManager = RedisSessionManager;
    console.log('[BrowserLoginManager] Initialized with BrowserInstanceManager and RedisSessionManager');
  }
  
  /**
   * Authenticate with Google Business Profile
   */
  public async authenticate(request: AuthRequest): Promise<AuthResult> {
    const traceId = request.traceId || `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();
    
    console.log(`[BrowserLoginManager:${traceId}] Starting authentication for business ${request.businessId}`);
    
    try {
      // Check if we can reuse an existing session
      if (request.options?.reuseSession !== false) {
        try {
          const existingSession = await this.sessionManager.getActiveSession(request.businessId);
          
          if (existingSession && existingSession.email === request.email) {
            console.log(`[BrowserLoginManager:${traceId}] Found active session for business ${request.businessId}`);
            
            // Get or activate the browser instance
            const instanceId = existingSession.sessionId;
            
            // Validate the browser instance
            const isValid = await this.browserManager.instanceExists(request.businessId);
            
            if (isValid) {
              console.log(`[BrowserLoginManager:${traceId}] Reusing existing browser instance for business ${request.businessId}`);
              
              // Return success with existing instance
              return {
                success: true,
                businessId: request.businessId,
                email: request.email,
                instanceId: request.businessId,
                sessionId: existingSession.id,
                traceId,
                timestamp,
                metadata: {
                  sessionReused: true,
                  sessionLastUsed: existingSession.lastUsed
                }
              };
            } else {
              console.log(`[BrowserLoginManager:${traceId}] Existing session found, but browser instance is invalid. Creating new instance...`);
            }
          }
        } catch (sessionError) {
          console.error(`[BrowserLoginManager:${traceId}] Error checking existing session:`, sessionError);
          // Continue to create a new session
        }
      }
      
      // Get or create a browser instance
      const instanceId = request.instanceId || request.businessId;
      await this.browserManager.getOrCreateInstance(instanceId);
      
      // Get the browser components
      const { browser, context, page } = await this.browserManager.getInstanceComponents(instanceId);
      
      // Execute the login sequence
      const loginResult = await this.executeLogin(page, context, {
        businessId: request.businessId,
        email: request.email,
        password: request.password,
        traceId,
        options: request.options
      });
      
      // Update the browser instance activity
      this.browserManager.updateInstanceActivity(instanceId);
      
      // If login was successful, save the session in Redis
      if (loginResult.success) {
        try {
          // Get cookies for storage
          const cookies = await context.cookies();
          
          // Create or update the session in Redis
          const session = await this.sessionManager.createSession({
            businessId: request.businessId,
            email: request.email,
            status: 'active',
            cookiesJson: JSON.stringify(cookies),
            userAgent: await page.evaluate(() => navigator.userAgent),
            metadata: {
              loginTimestamp: timestamp,
              traceId: traceId,
              browserInstanceId: instanceId
            }
          });
          
          console.log(`[BrowserLoginManager:${traceId}] Created session ${session.id} for business ${request.businessId}`);
          
          // Return success with session ID
          return {
            success: true,
            businessId: request.businessId,
            email: request.email,
            instanceId,
            sessionId: session.id,
            traceId,
            timestamp,
            metadata: {
              sessionCreated: true,
              loginDuration: loginResult.metadata?.loginDuration
            }
          };
        } catch (sessionError) {
          console.error(`[BrowserLoginManager:${traceId}] Error creating session:`, sessionError);
          
          // Return success anyway since login succeeded
          return {
            success: true,
            businessId: request.businessId,
            email: request.email,
            instanceId,
            traceId,
            timestamp,
            metadata: {
              sessionCreated: false,
              loginDuration: loginResult.metadata?.loginDuration,
              sessionError: sessionError instanceof Error ? sessionError.message : String(sessionError)
            }
          };
        }
      }
      
      // If login failed, handle the error
      return {
        success: false,
        businessId: request.businessId,
        email: request.email,
        instanceId,
        errorCode: loginResult.errorCode,
        errorMessage: loginResult.error,
        challenge: loginResult.challenge,
        traceId,
        timestamp,
        metadata: loginResult.metadata
      };
    } catch (error) {
      console.error(`[BrowserLoginManager:${traceId}] Unhandled error:`, error);
      
      // Create a standardized error
      const automationError = error instanceof Error 
        ? createError(
            ErrorCodes.AUTOMATION_ACTION_FAILED,
            error.message,
            {
              traceId,
              businessId: request.businessId,
              originalError: error
            }
          )
        : createError(
            ErrorCodes.UNKNOWN_ERROR,
            String(error),
            {
              traceId,
              businessId: request.businessId
            }
          );
      
      return {
        success: false,
        businessId: request.businessId,
        email: request.email,
        instanceId: request.instanceId || request.businessId,
        errorCode: automationError.code,
        errorMessage: automationError.message,
        traceId,
        timestamp,
        metadata: {
          category: automationError.category,
          severity: automationError.severity,
          retryable: automationError.retryable
        }
      };
    }
  }
  
  /**
   * Execute the login sequence with the given configuration
   */
  private async executeLogin(
    page: Page, 
    context: BrowserContext, 
    params: {
      businessId: string;
      email: string;
      password: string;
      traceId: string;
      options?: AuthRequest['options'];
    }
  ): Promise<LoginResult> {
    // Create login configuration
    const loginConfig: LoginConfig = {
      email: params.email,
      password: params.password,
      businessId: params.businessId,
      traceId: params.traceId,
      humanEmulation: params.options?.humanEmulation !== false,
      timeout: params.options?.timeout || 60000,
      maxRetries: params.options?.maxRetries || 3,
      screenshotOnError: true,
      screenshotPath: params.options?.screenshotPath || '/tmp/screenshots',
      headless: true,
      detectDevtools: true
    };
    
    // Execute login with retry
    return await ErrorRetry.withRetry(
      async () => executeGoogleLogin(page, context, loginConfig),
      {
        maxAttempts: loginConfig.maxRetries || 3,
        baseDelay: 1000,
        maxDelay: 10000,
        onRetry: (error, attempt, delay) => {
          console.log(`[BrowserLoginManager:${params.traceId}] Retrying login (attempt ${attempt}) after ${delay}ms: ${error.message}`);
        }
      }
    );
  }
  
  /**
   * Check if a session is valid for a business
   */
  public async checkSession(businessId: string): Promise<{
    valid: boolean;
    sessionId?: string;
    instanceId?: string;
    email?: string;
    lastUsed?: string;
  }> {
    try {
      const session = await this.sessionManager.getActiveSession(businessId);
      
      if (!session) {
        return { valid: false };
      }
      
      // Check if browser instance exists
      const instanceExists = await this.browserManager.instanceExists(businessId);
      
      return {
        valid: true,
        sessionId: session.id,
        instanceId: businessId,
        email: session.email,
        lastUsed: session.lastUsed
      };
    } catch (error) {
      console.error(`[BrowserLoginManager] Error checking session for business ${businessId}:`, error);
      return { valid: false };
    }
  }
  
  /**
   * Logout and clear session
   */
  public async logout(businessId: string): Promise<boolean> {
    try {
      // Find the session for this business
      const session = await this.sessionManager.getActiveSession(businessId);
      
      if (!session) {
        return false;
      }
      
      // Delete the session
      await this.sessionManager.deleteSession(session.id);
      
      // Remove the browser instance
      await this.browserManager.removeInstance(businessId);
      
      return true;
    } catch (error) {
      console.error(`[BrowserLoginManager] Error logging out business ${businessId}:`, error);
      return false;
    }
  }
  
  /**
   * Get debugging information
   */
  public async getDebugInfo(): Promise<any> {
    try {
      const browserInfo = await this.browserManager.getDebugInfo();
      const redisInfo = await this.sessionManager.getDebugInfo();
      
      return {
        browser: browserInfo,
        redis: redisInfo,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[BrowserLoginManager] Error getting debug info:', error);
      return {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export the singleton instance
export default BrowserLoginManager.getInstance();