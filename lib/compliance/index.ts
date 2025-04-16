/**
 * Compliance Library
 * 
 * This module contains utilities for compliance checks and content moderation.
 */

import { verifyComplianceToken, handleBusinessAuthentication } from './auth-service';
import { AuthStatus, BrowserInstance, GoogleAuthRequest } from './models';
import { BrowserAutomationService } from '../browser-automation';
import { v4 as uuidv4 } from 'uuid';

// Browser instances cache
const browserInstances: Map<string, BrowserInstance> = new Map();

// Create a class for Compliance Authentication
export class ComplianceAuthService {
  // Browser automation service instance
  private browserService: BrowserAutomationService;
  
  constructor() {
    // Initialize browser automation service
    this.browserService = BrowserAutomationService.getInstance();
  }
  
  /**
   * Check if the authentication status is valid for a business
   * 
   * @param businessId The business ID to check
   * @param token Optional token for validation
   * @returns Auth status object
   */
  async checkAuthStatus(businessId: string, token?: string): Promise<AuthStatus> {
    // First check if we have a browser instance for this business
    const browserInstance = browserInstances.get(businessId);
    
    if (browserInstance && browserInstance.status === 'active') {
      // Check if the browser instance is expired
      const lastUsed = new Date(browserInstance.lastUsed);
      const now = new Date();
      const expiresAt = new Date(lastUsed.getTime() + 24 * 60 * 60 * 1000); // 24 hours from last use
      
      if (now < expiresAt) {
        // Valid browser instance exists
        return {
          isValid: true,
          expiresAt: expiresAt.toISOString(),
          email: browserInstance.email,
          lastVerified: browserInstance.lastUsed,
          browserInstanceId: browserInstance.instanceId
        };
      } else {
        // Update the browser instance status to expired
        browserInstance.status = 'expired';
        browserInstances.set(businessId, browserInstance);
      }
    }
    
    // If token is provided and no valid browser instance, validate with token service
    if (token) {
      const verification = await verifyComplianceToken(token);
      if (verification.valid && verification.businessId) {
        // Return valid status with mock data
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
        
        return {
          isValid: true,
          expiresAt: expiresAt.toISOString(),
          email: 'business@example.com', // Would be pulled from real auth data
          lastVerified: now.toISOString()
        };
      }
    }
    
    // For now, return mock auth status based on businessId
    // In a real implementation, this would check a database
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    // Simple mock implementation - consider all valid except test cases
    const isValid = businessId !== 'invalid-business-id';
    
    return {
      isValid,
      expiresAt: isValid ? expiresAt.toISOString() : undefined,
      email: isValid ? 'business@example.com' : undefined, // Would be pulled from real auth data
      lastVerified: isValid ? now.toISOString() : undefined
    };
  }

  /**
   * Validate pre-auth credentials before creating a business
   * 
   * @param email The email to validate
   * @param encryptedPassword The encrypted password
   * @param nonce The encryption nonce
   * @param version The encryption version
   * @param browserInstanceId Optional browser instance ID
   * @returns Auth validation result
   */
  async validatePreAuth(
    email: string, 
    encryptedPassword: string, 
    nonce: string, 
    version: string,
    browserInstanceId?: string
  ): Promise<{
    isValid: boolean;
    message?: string;
    error?: string;
    browserInstanceId?: string;
  }> {
    console.log(`Validating pre-auth for email: ${email}, browser instance: ${browserInstanceId || 'none'}`);
    
    // In a real implementation, this would validate credentials against Google's API
    // For now, we'll just perform basic validation and return success
    
    // Basic email validation
    if (!email || !email.includes('@')) {
      return {
        isValid: false,
        error: 'Invalid email format'
      };
    }
    
    // Check for password data
    if (!encryptedPassword || !nonce || !version) {
      return {
        isValid: false,
        error: 'Missing authentication data'
      };
    }
    
    // For demo purposes, reject a specific test email
    if (email === 'test-fail@example.com') {
      return {
        isValid: false,
        error: 'Authentication failed'
      };
    }
    
    // Generate a new browser instance ID if one is not provided
    const instanceId = browserInstanceId || `browser-${uuidv4()}`;
    
    // Create a pending browser instance record
    const now = new Date().toISOString();
    browserInstances.set(instanceId, {
      instanceId: instanceId,
      businessId: 'pending', // Will be updated when business is created
      createdAt: now,
      lastUsed: now,
      status: 'active',
      email: email
    });
    
    // Return success with the browser instance ID
    return {
      isValid: true,
      message: 'Pre-authentication validation successful',
      browserInstanceId: instanceId
    };
  }
  
  /**
   * Perform Google authentication for a business
   * 
   * @param request Google authentication request
   * @returns Authentication result
   */
  async authenticateGoogle(request: GoogleAuthRequest): Promise<{
    success: boolean;
    taskId?: string;
    browserInstanceId?: string;
    error?: string;
    message?: string;
  }> {
    try {
      const { businessId, email, encryptedPassword, nonce, version, browserInstanceId, persistBrowser = true } = request;
      
      const timestamp = new Date().toISOString();
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - 🚀 STARTING GOOGLE AUTHENTICATION`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Business ID: ${businessId}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - User email: ${email}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Has encrypted password: ${!!encryptedPassword}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Has nonce: ${!!nonce}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Encryption version: ${version || 'not set'}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Browser instance ID: ${browserInstanceId || 'new instance'}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Persist browser: ${persistBrowser}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Environment: ${process.env.NODE_ENV || 'not set'}`);
      console.log(`[COMPLIANCE_AUTH] ${timestamp} - Browser API URL: ${process.env.BROWSER_API_URL || 'not set'}`);
      
      console.log(`[ComplianceAuth] 🔑 Using ${browserInstanceId ? 'provided' : 'new'} browser instance ID: ${browserInstanceId || 'to be generated'}`);
      
      // Need to decrypt the password - this would be done in the API route
      // For this implementation we assume it's handled
      
      // Generate a browser instance ID if one doesn't exist
      const instanceId = browserInstanceId || `browser-${businessId}-${Date.now()}`;
      
      console.log(`[ComplianceAuth] 🧩 Final browser instance ID: ${instanceId}`);
      
      // Log the current browser instances for debugging
      console.log(`[ComplianceAuth] 📊 Current active browser instances: ${Array.from(browserInstances.keys()).join(', ') || 'none'}`);
      
      // If a valid browser instance already exists, update it
      const existingInstance = browserInstances.get(businessId);
      if (existingInstance && existingInstance.status === 'active') {
        console.log(`[ComplianceAuth] ♻️ Reusing existing browser instance ${existingInstance.instanceId} for business ${businessId}`);
        
        // Update the instance
        existingInstance.lastUsed = new Date().toISOString();
        browserInstances.set(businessId, existingInstance);
        
        // Return success
        return {
          success: true,
          browserInstanceId: existingInstance.instanceId,
          message: 'Using existing authenticated browser instance'
        };
      }
      
      console.log(`[ComplianceAuth] 🔄 No existing browser instance for ${businessId}, creating new authentication session`);
      
      // Import the decryption function - this would be done in the API route
      // For real implementation:
      // const { decryptPassword } = await import('@/lib/utilities/password-encryption');
      // const password = decryptPassword({encryptedPassword, nonce, version});
      
      // Log the decryption process (without showing actual passwords)
      console.log(`[ComplianceAuth] 🔓 Decrypting password data (nonce length: ${nonce?.length || 0}, version: ${version || 'none'})`);
      
      // For demo purposes, we'll use a placeholder password
      // In production, this should use the actual decrypted password
      console.log(`[ComplianceAuth] ⚠️ Using placeholder password for development - real implementation would decrypt the password`);
      const password = "PLACEHOLDER_PASSWORD";
      
      // Initialize the browser automation task through the browser service
      console.log(`[ComplianceAuth] 🌐 Sending authentication request to browser service...`);
      const authResult = await this.browserService.authenticateGoogle(
        businessId,
        email,
        password
      );
      
      console.log(`[ComplianceAuth] 📊 Auth result status: ${authResult.status}, task ID: ${authResult.taskId || 'none'}`);
      
      if (authResult.status === 'success') {
        // Authentication successful - save the browser instance
        const now = new Date().toISOString();
        console.log(`[ComplianceAuth] ✅ Authentication successful for business ${businessId} with browser instance ${instanceId}`);
        
        const browserData = {
          instanceId: instanceId,
          businessId: businessId,
          createdAt: now,
          lastUsed: now,
          status: 'active' as const,
          email: email,
          sessionData: authResult.result
        };
        
        // Log what we're storing (without sensitive data)
        console.log(`[ComplianceAuth] 💾 Storing browser instance data:`, JSON.stringify({
          ...browserData,
          sessionData: browserData.sessionData ? '[Redacted Session Data]' : null
        }));
        
        // Store the browser instance
        browserInstances.set(businessId, browserData);
        
        // Double check that the instance was stored properly
        const storedInstance = browserInstances.get(businessId);
        console.log(`[ComplianceAuth] ✓ Verified browser instance stored: ${storedInstance ? 'Yes' : 'No'}`);
        
        if (storedInstance) {
          console.log(`[ComplianceAuth] ℹ️ Stored instance status: ${storedInstance.status}`);
        }
        
        // Return success with the browser instance ID
        return {
          success: true,
          taskId: authResult.taskId,
          browserInstanceId: instanceId,
          message: 'Google authentication successful'
        };
      } else {
        // Authentication failed
        console.error(`[ComplianceAuth] ❌ Authentication failed for business ${businessId}: ${authResult.error}`);
        
        // Create a failed browser instance record
        const now = new Date().toISOString();
        console.log(`[ComplianceAuth] 📝 Recording failed browser instance for ${businessId}`);
        
        const failedInstance = {
          instanceId: instanceId,
          businessId: businessId,
          createdAt: now,
          lastUsed: now,
          status: 'error' as const,
          email: email
        };
        
        browserInstances.set(businessId, failedInstance);
        
        // Log all error details
        console.error(`[ComplianceAuth] 🔍 Authentication error details:`, authResult.error);
        if (authResult.result) {
          console.error(`[ComplianceAuth] 🔍 Result data:`, JSON.stringify(authResult.result));
        }
        
        return {
          success: false,
          taskId: authResult.taskId,
          browserInstanceId: instanceId,
          error: authResult.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error(`[ComplianceAuth] 🔥 Unhandled error during Google authentication:`, error);
      
      // Include stack trace for better debugging
      if (error instanceof Error && error.stack) {
        console.error(`[ComplianceAuth] Stack trace:`, error.stack);
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during authentication'
      };
    }
  }
  
  /**
   * Activate a browser instance for use
   * 
   * @param businessId The business ID
   * @param instanceId The browser instance ID
   * @returns Success indicator
   */
  async activateBrowserInstance(businessId: string, instanceId: string): Promise<boolean> {
    // Check if the browser instance exists
    const instance = browserInstances.get(instanceId);
    
    if (instance && instance.businessId === businessId) {
      // Update the last used timestamp
      instance.lastUsed = new Date().toISOString();
      browserInstances.set(instanceId, instance);
      
      console.log(`Activated browser instance ${instanceId} for business ${businessId}`);
      return true;
    }
    
    return false;
  }
}

export const supervisorAgent = {
  // Mock implementation of a compliance checking function
  async checkCompliance(content: string, industry: string = 'general'): Promise<any> {
    // In a real implementation, this would call an API or service
    // For now, we just return a mock result
    return {
      compliant: true,
      score: 0.95,
      warnings: [],
      suggestions: [],
      industry,
      timestamp: new Date().toISOString(),
    };
  },
  
  // Mock implementation of a content moderation check
  async moderateContent(content: string): Promise<any> {
    // Simulated moderation result - would call a real service in production
    return {
      appropriate: true,
      contentFlags: [],
      sensitiveTopics: [],
      timestamp: new Date().toISOString(),
    };
  }
};

export const complianceCategories = [
  { id: 'advertising', name: 'Advertising Standards' },
  { id: 'privacy', name: 'Privacy & Data Protection' },
  { id: 'accessibility', name: 'Accessibility' },
  { id: 'disclosures', name: 'Required Disclosures' },
  { id: 'industry', name: 'Industry-Specific Rules' },
];

export const industryOptions = [
  { value: 'general', label: 'General Business' },
  { value: 'financial', label: 'Financial Services' },
  { value: 'health', label: 'Healthcare & Medical' },
  { value: 'ecommerce', label: 'E-commerce & Retail' },
  { value: 'technology', label: 'Technology & SaaS' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality & Travel' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'nonprofit', label: 'Non-profit & Charity' },
  { value: 'real-estate', label: 'Real Estate' },
];