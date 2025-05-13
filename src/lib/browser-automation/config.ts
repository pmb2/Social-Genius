/**
 * Browser Automation Configuration
 * 
 * Centralized configuration for browser automation services with 
 * environment variable handling and fallbacks.
 */

// Default values for development environment
const DEFAULT_BROWSER_API_URL = 'http://browser-use-api:5055';
// Fallback URLs to try if the default doesn't work
const FALLBACK_BROWSER_API_URLS = [
  'http://browser-use-api:5055',
  'http://localhost:5055',
  'http://host.docker.internal:5055',
  'http://127.0.0.1:5055'
];
const DEFAULT_API_TIMEOUT = 60000; // 60 seconds
const DEFAULT_POLLING_INTERVAL = 2000; // 2 seconds
const DEFAULT_MAX_POLLING_ATTEMPTS = 30;

// Environment configuration with fallbacks
export const BrowserAutomationConfig = {
  // Base URL for the external Browser-Use API
  // Making this a dynamic property that can be updated at runtime if needed
  _apiUrl: process.env.BROWSER_USE_API_URL || DEFAULT_BROWSER_API_URL,
  
  // Track which fallback URLs we've tried
  _fallbackUrls: FALLBACK_BROWSER_API_URLS,
  _currentFallbackIndex: -1,
  _connectionFailures: 0,
  
  get apiUrl() {
    return this._apiUrl;
  },
  
  set apiUrl(value) {
    console.log(`[BrowserAutomationConfig] Updating API URL from ${this._apiUrl} to ${value}`);
    this._apiUrl = value;
  },
  
  /**
   * Try the next fallback API URL
   * @returns The next URL to try
   */
  tryNextFallbackUrl() {
    this._currentFallbackIndex++;
    this._connectionFailures++;
    
    // If we've tried all fallbacks, start over
    if (this._currentFallbackIndex >= this._fallbackUrls.length) {
      console.log(`[BrowserAutomationConfig] Tried all ${this._fallbackUrls.length} fallback URLs, starting over`);
      this._currentFallbackIndex = 0;
    }
    
    const nextUrl = this._fallbackUrls[this._currentFallbackIndex];
    console.log(`[BrowserAutomationConfig] Trying fallback URL #${this._currentFallbackIndex+1}: ${nextUrl}`);
    this.apiUrl = nextUrl;
    
    return nextUrl;
  },
  
  /**
   * Reset connection failures counter and fallback index on successful connection
   */
  resetConnectionAttempts() {
    const previousFailures = this._connectionFailures;
    this._connectionFailures = 0;
    this._currentFallbackIndex = -1;
    
    if (previousFailures > 0) {
      console.log(`[BrowserAutomationConfig] Connection established after ${previousFailures} failures. Reset counter.`);
    }
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
  
  // Get the complete URL for an endpoint
  getEndpointUrl(endpoint: keyof typeof BrowserAutomationConfig.endpoints): string {
    const base = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;
    const apiPath = this.endpoints[endpoint].startsWith('/') 
      ? this.endpoints[endpoint] 
      : '/' + this.endpoints[endpoint];
    
    // Avoid duplicate version prefixes
    // Check if apiPath already includes the version prefix (like '/v1/something')
    const versionPrefix = `/${this.apiVersion}`;
    if (apiPath.startsWith(versionPrefix)) {
      // API path already includes version (e.g., '/v1/google-auth'), don't add version again
      return `${base}${apiPath}`;
    } else {
      // API path doesn't include version (e.g., '/google-auth'), add version prefix
      return `${base}${versionPrefix}${apiPath}`;
    }
  },
  
  // Helper method to check if the development environment is active
  isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }
};

// Log configuration at startup if in development mode
if (process.env.NODE_ENV !== 'production') {
  console.log('[BrowserAutomationConfig] Using configuration:', {
    apiUrl: BrowserAutomationConfig.apiUrl,
    apiVersion: BrowserAutomationConfig.apiVersion,
    timeouts: BrowserAutomationConfig.timeouts,
    polling: BrowserAutomationConfig.polling,
    logging: BrowserAutomationConfig.logging,
    endpoints: BrowserAutomationConfig.endpoints,
    isDevelopment: BrowserAutomationConfig.isDevelopment(),
  });
}