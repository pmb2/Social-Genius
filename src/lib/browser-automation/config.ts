/**
 * Browser Automation Configuration - DEPRECATED
 * 
 * This module is no longer in use as we've migrated to direct API integration.
 * Keeping it as a placeholder for backwards compatibility.
 */

// Default values with API endpoints that no longer exist (commented out)
// This file is kept for backwards compatibility but the browser-use functionality is disabled
const DEFAULT_BROWSER_API_URL = 'http://api-placeholder:5055'; // This doesn't exist anymore
// Placeholder fallback URLs (these don't exist anymore)
const FALLBACK_BROWSER_API_URLS: string[] = [];
const DEFAULT_API_TIMEOUT = 60000; // 60 seconds
const DEFAULT_POLLING_INTERVAL = 2000; // 2 seconds
const DEFAULT_MAX_POLLING_ATTEMPTS = 30;

// Environment configuration - DEPRECATED AND NON-FUNCTIONAL
export const BrowserAutomationConfig = {
  // Base URL for the external Browser-Use API - NO LONGER USED
  _apiUrl: 'deprecated-api-url',
  
  // Track which fallback URLs we've tried (none exist now)
  _fallbackUrls: FALLBACK_BROWSER_API_URLS,
  _currentFallbackIndex: -1,
  _connectionFailures: 0,
  
  get apiUrl() {
    console.warn('[DEPRECATED] BrowserAutomationConfig.apiUrl is no longer functional. Using API integration instead.');
    return this._apiUrl;
  },
  
  set apiUrl(value) {
    console.warn('[DEPRECATED] BrowserAutomationConfig.apiUrl is no longer functional. Using API integration instead.');
    this._apiUrl = value;
  },
  
  /**
   * Try the next fallback API URL - DEPRECATED
   * @returns The next URL to try
   */
  tryNextFallbackUrl() {
    console.warn('[DEPRECATED] BrowserAutomationConfig.tryNextFallbackUrl is no longer functional. Using API integration instead.');
    return '';
  },
  
  /**
   * Reset connection attempts - DEPRECATED
   */
  resetConnectionAttempts() {
    console.warn('[DEPRECATED] BrowserAutomationConfig.resetConnectionAttempts is no longer functional. Using API integration instead.');
  },
  
  // API version for endpoint URLs
  apiVersion: process.env.BROWSER_API_VERSION || 'v1',
  
  // Timeout values
  timeouts: {
    // Default request timeout
    request: parseInt(process.env.BROWSER_API_TIMEOUT || String(DEFAULT_API_TIMEOUT), 10),
    
    // Authentication timeout (longer to handle CAPTCHA)
    auth: parseInt(process.env.BROWSER_AUTH_TIMEOUT || '90000', 10),
    
    // Profile update timeout
    profileUpdate: parseInt(process.env.BROWSER_PROFILE_TIMEOUT || '120000', 10),
    
    // Post creation timeout
    postCreation: parseInt(process.env.BROWSER_POST_TIMEOUT || '120000', 10),
  },
  
  // Polling configuration for task status
  polling: {
    // Interval between polling attempts
    interval: parseInt(process.env.BROWSER_POLLING_INTERVAL || String(DEFAULT_POLLING_INTERVAL), 10),
    
    // Maximum number of polling attempts
    maxAttempts: parseInt(process.env.BROWSER_MAX_POLLING_ATTEMPTS || String(DEFAULT_MAX_POLLING_ATTEMPTS), 10),
  },
  
  // Logging options
  logging: {
    // Whether to enable verbose logging
    verbose: process.env.BROWSER_VERBOSE_LOGGING === 'true',
    
    // Whether to log sensitive information (NEVER in production)
    logSensitive: process.env.NODE_ENV !== 'production' && process.env.BROWSER_LOG_SENSITIVE === 'true',
  },
  
  // Endpoints configuration
  endpoints: {
    // Google authentication endpoint (including version prefix to match server endpoints)
    googleAuth: '/v1/google-auth',
    
    // Task status endpoint
    taskStatus: '/v1/task',
    
    // Screenshot endpoints
    screenshot: '/v1/screenshot',
    screenshotList: '/v1/screenshot',
    
    // Session management endpoints
    session: '/v1/session',
    sessionValidate: '/v1/session/validate',
    
    // Business profile endpoints
    profileUpdate: '/v1/business/update-profile',
    businessPost: '/v1/business/post',
    replyToReviews: '/v1/business/reply-reviews',
    businessInfo: '/v1/business/info',
    
    // Health check endpoint
    health: '/health', // Keep health check without version for backwards compatibility
    
    // Task termination endpoint
    terminateTask: '/v1/terminate',
  },
  
  // Get the complete URL for an endpoint - DEPRECATED
  getEndpointUrl(endpoint: keyof typeof BrowserAutomationConfig.endpoints): string {
    console.warn(`[DEPRECATED] BrowserAutomationConfig.getEndpointUrl(${endpoint}) is no longer functional. Using API integration instead.`);
    return '/api/deprecated-endpoint';
  },
  
  // Helper method to check if the development environment is active
  isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
};

// Log deprecation warning at startup
console.warn('[DEPRECATED] BrowserAutomationConfig is no longer in use. The application has been migrated to direct API integration.');