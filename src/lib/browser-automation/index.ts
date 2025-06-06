// DEPRECATED: This module is no longer in use as we've migrated to direct API integration.
// Keeping it as a placeholder for backwards compatibility.

import { 
  logBrowserOperation, 
  LogLevel, 
  OperationCategory 
} from '@/lib/utilities/browser-logging';

// Log deprecation warning
console.warn('[DEPRECATED] Browser automation module is no longer in use. The application has been migrated to direct API integration.');

// Types for Browser-Use API
export interface BrowserTask {
  businessId: string;
  taskId?: string;
  email: string;
  password: string;
  taskType: 'login' | 'post' | 'info' | 'review';
  timeout?: number;
  additionalData?: Record<string, any>;
}

export interface BrowserTaskResult {
  taskId: string;
  businessId: string;
  status: 'success' | 'failed' | 'in_progress';
  result?: any;
  error?: string;
  screenshot?: string;
  traceId: string;     // Trace ID for cross-component tracking
  startTime?: number;  // Timestamp when the task started
  endTime?: number;    // Timestamp when the task completed
  duration?: number;   // Duration in milliseconds
  screenshots?: string[]; // Array of screenshot paths
}

// DEPRECATED: Browser Automation Service - stub implementation
export class BrowserAutomationService {
  private static instance: BrowserAutomationService;

  private constructor() {
    console.warn('[DEPRECATED] BrowserAutomationService is no longer functional. Application has migrated to direct API integration.');
  }

  public static getInstance(): BrowserAutomationService {
    if (!BrowserAutomationService.instance) {
      BrowserAutomationService.instance = new BrowserAutomationService();
    }
    return BrowserAutomationService.instance;
  }

  /**
   * DEPRECATED: Authenticate with Google using browser automation
   * This method is no longer functional as we've migrated to direct API integration.
   * 
   * @param businessId The business ID to associate with this authentication session
   * @param email Google account email
   * @param password Google account password or encrypted credentials
   * @param options Additional authentication options
   */
  public async authenticateGoogle(
    businessId: string,
    email: string,
    password: string | any, // Support both string passwords and encrypted credential objects
    options?: {
      reuseSession?: boolean;
      persistSession?: boolean;
      debug?: boolean;
      takeScreenshots?: boolean;
    }
  ): Promise<BrowserTaskResult> {
    console.warn('[DEPRECATED] authenticateGoogle method is no longer functional. Application has migrated to direct API integration.');
    
    return {
      taskId: `deprecated-${Date.now()}`,
      businessId,
      status: 'failed',
      error: 'Browser automation has been deprecated. Application now uses direct API integration.',
      traceId: `deprecated-${businessId}-${Date.now()}`
    };
    
    /* Original implementation removed - no longer needed */
    
    try {
      // Import screenshot utilities 
      const { ensureUserScreenshotDirectory, capturePageScreenshot } = await import('@/lib/utilities/browser-logging');
      
      // Ensure screenshot directory exists
      if (takeScreenshots) {
        const screenshotDir = ensureUserScreenshotDirectory(businessId);
        console.log(`[BROWSER_AUTOMATION:${traceId}] Screenshot directory prepared: ${screenshotDir}`);
      }
      
      // Add more visible logging with clear prefix and timestamp
      const timestamp = new Date().toISOString();
      const debug = options?.debug || process.env.BROWSER_DEBUG === 'true' || false;
      
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 🚀 STARTING GOOGLE AUTHENTICATION`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Business ID: ${businessId}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - User email: ${email}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Password type: ${typeof password === 'string' ? 'string' : 'credential object'}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Reuse session: ${reuseSession}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Persist session: ${persistSession}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Take screenshots: ${takeScreenshots}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Debug mode: ${debug}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Process ID: ${process.pid}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Node environment: ${process.env.NODE_ENV || 'not set'}`);
      
      // Extract actual password - either use the string directly or extract from credential object
      let actualPassword = password;
      if (typeof password !== 'string' && password && password.encryptedPassword) {
        console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Using encrypted password from credential object`);
        // For development/testing, just use the encrypted password directly
        actualPassword = password.encryptedPassword;
      }
      
      // Log any environment variables that might affect browser operation
      const relevantEnvVars = {
        BROWSER_USE_API_URL: process.env.BROWSER_USE_API_URL || 'not set',
        BROWSER_API_VERSION: process.env.BROWSER_API_VERSION || 'not set',
        BROWSER_API_TIMEOUT: process.env.BROWSER_API_TIMEOUT || 'not set',
        BROWSER_POLLING_INTERVAL: process.env.BROWSER_POLLING_INTERVAL || 'not set',
        BROWSER_VERBOSE_LOGGING: process.env.BROWSER_VERBOSE_LOGGING || 'not set',
      };
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Environment variables:`, JSON.stringify(relevantEnvVars));
      
      // Log API configuration for debugging
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API Configuration:`, {
        apiUrl: BrowserAutomationConfig.apiUrl,
        apiVersion: BrowserAutomationConfig.apiVersion,
        authEndpoint: BrowserAutomationConfig.getEndpointUrl('googleAuth'),
        timeout: BrowserAutomationConfig.timeouts.auth
      });
      
      logBrowserOperation(
        OperationCategory.AUTH, 
        `Starting Google authentication for business ID: ${businessId}, email: ${email}`,
        LogLevel.INFO,
        { 
          businessId, 
          email, 
          options: { reuseSession, persistSession, debug, takeScreenshots },
          timestamp: new Date().toISOString(),
          apiConfig: {
            url: BrowserAutomationConfig.apiUrl,
            version: BrowserAutomationConfig.apiVersion,
            timeout: BrowserAutomationConfig.timeouts.auth
          }
        },
        traceId
      );
      
      // First, check if we have a valid existing session if reuse is enabled
      if (reuseSession) {
        logBrowserOperation(
          OperationCategory.SESSION,
          `Checking for existing session for business ${businessId}`,
          LogLevel.INFO,
          undefined,
          traceId
        );
        
        // Check if we have a session
        const sessionCheck = await this.checkSession(businessId);
        
        // If we have a session and it's not marked as expired, validate it
        if (sessionCheck.hasSession && !sessionCheck.isExpired) {
          logBrowserOperation(
            OperationCategory.SESSION,
            `Found existing session for business ${businessId}, validating...`,
            LogLevel.INFO,
            undefined,
            traceId
          );
          
          // Validate session
          const validation = await this.validateSession(businessId);
          
          // If the session is valid, we can use it
          if (validation.valid) {
            logBrowserOperation(
              OperationCategory.SESSION,
              `Successfully reused existing valid session for business ${businessId}`,
              LogLevel.INFO,
              undefined,
              traceId
            );
            
            // Return success result with reused session
            return {
              taskId: `reused-${traceId}`,
              businessId,
              status: 'success',
              result: {
                reusedSession: true,
                message: 'Successfully reused existing Google session',
                validationScreenshot: validation.screenshot,
                traceId: traceId
              }
            };
          }
          
          logBrowserOperation(
            OperationCategory.SESSION,
            `Existing session for business ${businessId} is invalid, creating new login session`,
            LogLevel.WARN,
            undefined,
            traceId
          );
        }
      }
      
      // Add thorough API connection logging with timestamp
      const apiUrl = BrowserAutomationConfig.apiUrl;
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 🔌 CONNECTING TO BROWSER API`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API URL: ${apiUrl}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API Timeout: ${BrowserAutomationConfig.timeouts.auth}ms`);
      
      // Check environment variables that might affect the connection
      const envVars = {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        BROWSER_API_URL: process.env.BROWSER_API_URL || 'not set',
        BROWSER_API_PORT: process.env.BROWSER_API_PORT || 'not set'
      };
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Environment variables:`, JSON.stringify(envVars));
      
      // Try to ping the API to confirm accessibility with fallbacks
      try {
        const pingStart = Date.now();
        console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Pinging API before auth request...`);
        let healthUrl = BrowserAutomationConfig.getEndpointUrl('health');
        console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Initial Health URL: ${healthUrl}`);
        
        // Log each step of the connection process in detail
        console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - DNS lookup for: ${new URL(healthUrl).hostname}`);
        console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Connection attempt starting...`);
        
        // Try to connect with fallback mechanism
        let pingSuccess = false;
        let pingTime = 0;
        let healthResponse = null;
        let attemptCount = 0;
        const maxAttempts = 3;
        
        while (!pingSuccess && attemptCount < maxAttempts) {
          attemptCount++;
          healthUrl = BrowserAutomationConfig.getEndpointUrl('health');
          
          try {
            console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Ping attempt ${attemptCount} to: ${healthUrl}`);
            // Only wait 3 seconds for the health check
            healthResponse = await axios.get(healthUrl, { 
              timeout: 3000,
              headers: {
                'Cache-Control': 'no-cache',
                'X-Ping-Attempt': `${attemptCount}`,
                'X-Host-Info': process.env.HOSTNAME || 'unknown-host',
                'X-Trace-ID': traceId
              }
            });
            
            // Check if the response is successful
            if (healthResponse && healthResponse.data && healthResponse.data.status === 'healthy') {
              pingSuccess = true;
              pingTime = Date.now() - pingStart;
              console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API health check succeeded on attempt ${attemptCount}: ${healthResponse.data.status} (${pingTime}ms)`);
              
              // Reset connection failures on success
              BrowserAutomationConfig.resetConnectionAttempts();
              break;
            } else {
              console.warn(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API responded but unhealthy on attempt ${attemptCount}: ${healthResponse?.data?.status || 'unknown'}`);
              // Try next fallback URL
              BrowserAutomationConfig.tryNextFallbackUrl();
            }
          } catch (attemptError) {
            console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API health check attempt ${attemptCount} failed:`, attemptError.message);
            
            // Try next fallback URL
            BrowserAutomationConfig.tryNextFallbackUrl();
          }
        }
        
        // Report final status
        if (pingSuccess) {
          console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API health check final result: HEALTHY (${pingTime}ms)`);
        } else {
          console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - API health check final result: UNHEALTHY after ${attemptCount} attempts`);
          console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Will still attempt to use API but might fail`);
        }
      } catch (pingError) {
        console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Error during ping sequence:`, pingError.message);
      }
      
      logBrowserOperation(
        OperationCategory.API, 
        `Connecting to Browser-Use API at ${apiUrl}`,
        LogLevel.INFO,
        undefined,
        traceId
      );
      
      // Use the correct endpoint from the Browser Use API
      const requestDataLog = {
        businessId,
        email,
        password: '**REDACTED**', // Safe for logging
        taskType: 'login',
        timeout: BrowserAutomationConfig.timeouts.auth,
        reuseSession: reuseSession,
        advanced_options: {
          // These options improve the human-like behavior and CAPTCHA handling
          human_delay_min: 1,
          human_delay_max: 3,
          max_captcha_attempts: 2,
          persist_session: persistSession,
          reuse_session: reuseSession,
          take_screenshots: takeScreenshots,
          trace_id: traceId
        }
      };
      
      logBrowserOperation(
        OperationCategory.API, 
        'Sending auth request with options',
        LogLevel.INFO,
        requestDataLog, // Will be automatically sanitized
        traceId
      );
      
      // Start timing the request
      const startTime = Date.now();
      const authEndpoint = BrowserAutomationConfig.getEndpointUrl('googleAuth');
      
      // Log detailed information about the request
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 📡 SENDING AUTH REQUEST`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Endpoint: ${authEndpoint}`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Method: POST`);
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Request timeout: ${BrowserAutomationConfig.timeouts.auth + 5000}ms`);
      
      // Enhanced browser API connectivity test with session header support
      try {
        const pingStart = Date.now();
        console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 🧪 Testing API connectivity for authentication...`);
        
        // Create a custom instance of axios with automatic retry for this connection test
        const axiosRetry = require('axios').create();
        let retryCount = 0;
        const maxRetries = 3;
        
        // Add request interceptor for retry logic
        axiosRetry.interceptors.response.use(undefined, async (err) => {
          // Track the endpoint being retried 
          const config = err.config;
          
          // If we've already tried too many times for this endpoint, fail
          if (config.__retryCount >= maxRetries) {
            console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ⛔ Max retries (${maxRetries}) reached for ${config.url}`);
            return Promise.reject(err);
          }
          
          // Set up retry count
          config.__retryCount = config.__retryCount || 0;
          config.__retryCount++;
          retryCount++;
          
          // Log the retry
          console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 🔄 Retry ${config.__retryCount}/${maxRetries} for ${config.url} (${err.code || err.message})`);
          
          // Add a delay before retrying
          const delay = Math.min(config.__retryCount * 500, 2000); // Exponential backoff capped at 2s
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return axiosRetry(config); // Retry with the exact same config
        });
        
        // Add diagnostic headers to all requests
        axiosRetry.interceptors.request.use((config) => {
          // Add custom headers for diagnostics
          config.headers = {
            ...config.headers,
            'X-Connection-Test': 'true',
            'X-Timestamp': new Date().toISOString(),
            'X-Request-ID': `conn-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            'X-Business-ID': businessId,
            'X-Browser-Client-Version': '1.0.0',
            'Cache-Control': 'no-cache, no-store',
            'X-Node-Process-ID': process.pid.toString(),
            'X-Host-Info': process.env.HOSTNAME || 'unknown-host',
            'X-Trace-ID': traceId
          };
          
          return config;
        });
        
        // Use our fallback URL system from the BrowserAutomationConfig
        let pingSuccess = false;
        let pingTime = -1;
        let workingEndpoint = '';
        let healthResponse = null;
        const testStartTime = Date.now();
        
        // Test using BrowserAutomationConfig's fallback mechanism
        // We'll try up to 3 URLs directly
        for (let i = 0; i < 3; i++) {
          if (i > 0) {
            // Try next fallback URL (first attempt uses current URL)
            BrowserAutomationConfig.tryNextFallbackUrl();
          }
          
          const currentEndpoint = BrowserAutomationConfig.getEndpointUrl('health');
          
          try {
            console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 🔌 Testing endpoint #${i+1}: ${currentEndpoint}`);
            
            // Make a request with retries built in
            healthResponse = await axiosRetry.get(currentEndpoint, { 
              timeout: 5000,  // Increased timeout for better reliability
              headers: {
                'X-Trace-ID': traceId
              }
            });
            
            if (healthResponse && healthResponse.status >= 200 && healthResponse.status < 300) {
              pingTime = Date.now() - testStartTime;
              pingSuccess = true;
              workingEndpoint = currentEndpoint;
              console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ✅ Connection successful to ${currentEndpoint} (${pingTime}ms)`);
              
              // Record that this URL works in the config by resetting the failure counter
              BrowserAutomationConfig.resetConnectionAttempts();
              
              // No need to try more endpoints
              break;
            } else {
              console.warn(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ⚠️ Endpoint ${currentEndpoint} returned non-success status: ${healthResponse?.status}`);
            }
          } catch (endpointError) {
            console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ Failed to connect to ${currentEndpoint}: ${endpointError.message} (${endpointError.code || 'UNKNOWN_ERROR'})`);
          }
        }
        
        // Report final connectivity status
        const totalConnectionTime = Date.now() - pingStart;
        
        if (pingSuccess) {
          console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 🌐 API connectivity test complete: SUCCESS (${pingTime}ms) at ${workingEndpoint}`);
          console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - 📊 Total connection test time: ${totalConnectionTime}ms with ${retryCount} retries`);
        } else {
          console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ API connectivity test complete: FAILED after ${totalConnectionTime}ms`);
          
          // Diagnostic info to help troubleshoot
          console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ Network diagnostic information:`);
          console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ Current API URL: ${BrowserAutomationConfig.apiUrl}`);
          console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ Environment: BROWSER_USE_API_URL=${process.env.BROWSER_USE_API_URL || 'not set'}, NODE_ENV=${process.env.NODE_ENV || 'not set'}`);
          console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ Process info: PID=${process.pid}, Running in Docker=${process.env.RUNNING_IN_DOCKER === 'true' ? 'Yes' : 'No/Unknown'}`);
          
          // Try to do some basic network diagnosis
          try {
            // Check if we can reach common internet hosts as a sanity check
            const dnsPromise = new Promise((resolve) => {
              const dns = require('dns');
              dns.lookup('google.com', (err, address) => {
                if (err) {
                  console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ DNS lookup for google.com failed:`, err.message);
                  resolve(false);
                } else {
                  console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ✅ DNS lookup successful: google.com = ${address}`);
                  resolve(true);
                }
              });
            });
            
            // Wait up to 3 seconds for the DNS check
            await Promise.race([
              dnsPromise,
              new Promise(resolve => setTimeout(() => {
                console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ DNS lookup timed out`);
                resolve(false);
              }, 3000))
            ]);
            
          } catch (diagnosticError) {
            console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ❌ Error during network diagnostics:`, diagnosticError.message);
          }
        }
      } catch (error) {
        console.error(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - ⚠️ API connectivity test error: ${error.message}`);
      }
      
      // Use the endpoint from config
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Sending auth request to endpoint: ${BrowserAutomationConfig.getEndpointUrl('googleAuth')}`);
      const requestData = {
        businessId,
        email,
        password: actualPassword, // Send extracted password to API
        taskType: 'login',
        timeout: BrowserAutomationConfig.timeouts.auth,
        reuseSession: reuseSession,
        traceId: traceId, // Include trace ID in the request
        advanced_options: {
          human_delay_min: 1,
          human_delay_max: 3,
          max_captcha_attempts: 2,
          persist_session: persistSession,
          reuse_session: reuseSession,
          take_screenshots: takeScreenshots,
          trace_id: traceId,
          record_screenshots: true, // Always record screenshot locations
          screenshot_points: [
            'login-start',
            'enter-email',
            'enter-password',
            'before-submit', 
            'after-login',
            'challenge-detection',
            'business-profile',
            'login-complete'
          ]
        }
      };
      
      console.log(`[BROWSER_AUTOMATION:${traceId}] ${timestamp} - Request data:`, {
        ...requestData,
        password: '***REDACTED***' // Don't log password
      });
      
      // Send the authentication request to the browser-use API
      const response = await axios.post(
        BrowserAutomationConfig.getEndpointUrl('googleAuth'), 
        requestData,
        {
          // Add timeout to request
          timeout: BrowserAutomationConfig.timeouts.auth + 5000, // Add 5s buffer
          headers: {
            'Content-Type': 'application/json',
            'X-Business-ID': businessId,
            'X-Request-ID': `auth-${Date.now()}`,
            'X-Trace-ID': traceId
          }
        }
      );
      
      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;
        // The API returns a task_id for asynchronous processing
        logBrowserOperation(
          OperationCategory.TASK, 
          `Auth task initiated successfully with task ID: ${taskId}`,
          LogLevel.INFO,
          { traceId },
          traceId
        );
        
        logBrowserOperation(
          OperationCategory.API, 
          `Response received in ${Date.now() - startTime}ms`,
          LogLevel.INFO,
          undefined,
          traceId
        );
        
        // Poll for task completion
        let attempts = 0;
        const maxAttempts = BrowserAutomationConfig.polling.maxAttempts;
        let taskResult = null;
        
        logBrowserOperation(
          OperationCategory.TASK, 
          `Polling for task completion (max ${maxAttempts} attempts)...`,
          LogLevel.INFO,
          undefined,
          traceId
        );
        
        while (attempts < maxAttempts) {
          attempts++;
          
          try {
            // Check task status
            logBrowserOperation(
              OperationCategory.TASK, 
              `Polling attempt ${attempts}/${maxAttempts} for task ${taskId}`,
              LogLevel.INFO,
              undefined,
              traceId
            );
            
            const statusUrl = BrowserAutomationConfig.getEndpointUrl('taskStatus') + `/${taskId}`;
            const statusResponse = await axios.get(statusUrl, {
              timeout: BrowserAutomationConfig.timeouts.request,
              headers: {
                'X-Trace-ID': traceId
              }
            });
            
            logBrowserOperation(
              OperationCategory.TASK, 
              `Status response received: ${statusResponse.data.status}`,
              LogLevel.INFO,
              undefined,
              traceId
            );
            
            if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'failed') {
              taskResult = statusResponse.data;
              logBrowserOperation(
                OperationCategory.TASK, 
                `Task ${taskId} ${statusResponse.data.status} after ${attempts} attempts`,
                LogLevel.INFO,
                undefined,
                traceId
              );
              
              // Check if we have screenshot data and log it
              if (statusResponse.data.screenshots && statusResponse.data.screenshots.length > 0) {
                logBrowserOperation(
                  OperationCategory.TASK, 
                  `Task has ${statusResponse.data.screenshots.length} screenshots available`,
                  LogLevel.INFO,
                  { screenshots: statusResponse.data.screenshots },
                  traceId
                );
              }
              
              // Log additional details for failed tasks
              if (statusResponse.data.status === 'failed') {
                logBrowserOperation(
                  OperationCategory.TASK, 
                  `Task failed with error: ${statusResponse.data.message || 'Unknown error'}`,
                  LogLevel.ERROR,
                  statusResponse.data.result,
                  traceId
                );
              }
              
              break;
            }
            
            // Calculate the next polling interval with exponential backoff and jitter
            const baseInterval = BrowserAutomationConfig.polling.interval;
            const exponentialDelay = baseInterval * Math.pow(2, attempts - 1); // 2^0, 2^1, 2^2, ...
            const jitter = Math.random() * baseInterval * 0.1; // 0-10% of base interval
            const nextPollInterval = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
            
            logBrowserOperation(
              OperationCategory.TASK, 
              `Waiting ${Math.round(nextPollInterval)}ms before next polling attempt (exponential backoff)`,
              LogLevel.INFO,
              undefined,
              traceId
            );
            
            // Wait before checking again with exponential backoff
            await new Promise(resolve => setTimeout(resolve, nextPollInterval));
          } catch (pollError) {
            logBrowserOperation(
              OperationCategory.TASK, 
              `Error polling task ${taskId} status (attempt ${attempts})`,
              LogLevel.ERROR,
              pollError,
              traceId
            );
            
            // Calculate backoff interval with jitter even for errors
            const baseInterval = BrowserAutomationConfig.polling.interval;
            const exponentialDelay = baseInterval * Math.pow(2, attempts - 1);
            const jitter = Math.random() * baseInterval * 0.1;
            const nextPollInterval = Math.min(exponentialDelay + jitter, 30000);
            
            logBrowserOperation(
              OperationCategory.TASK, 
              `Waiting ${Math.round(nextPollInterval)}ms before retry after error (exponential backoff)`,
              LogLevel.INFO,
              undefined,
              traceId
            );
            
            // Continue polling despite errors with exponential backoff
            await new Promise(resolve => setTimeout(resolve, nextPollInterval));
          }
        }
        
        // Process final result
        if (taskResult) {
          const finalStatus = taskResult.status === 'completed' && taskResult.result?.success ? 'success' : 'failed';
          
          logBrowserOperation(
            OperationCategory.TASK, 
            `Task ${response.data.task_id} final status: ${finalStatus}`,
            LogLevel.INFO,
            undefined,
            traceId
          );
          
          if (finalStatus === 'success') {
            logBrowserOperation(
              OperationCategory.AUTH, 
              `Google authentication successful for business ${businessId}`,
              LogLevel.INFO,
              undefined,
              traceId
            );
            
            // Check if we have screenshot data
            if (taskResult.result?.screenshot) {
              logBrowserOperation(
                OperationCategory.TASK, 
                `Screenshot captured successfully`,
                LogLevel.INFO,
                undefined,
                traceId
              );
            }
            
            // Check for multiple screenshots
            if (taskResult.screenshots && taskResult.screenshots.length > 0) {
              logBrowserOperation(
                OperationCategory.TASK, 
                `${taskResult.screenshots.length} screenshots captured during authentication`,
                LogLevel.INFO,
                { screenshots: taskResult.screenshots },
                traceId
              );
            }
          } else {
            logBrowserOperation(
              OperationCategory.AUTH, 
              `Google authentication failed for business ${businessId}`,
              LogLevel.ERROR,
              { 
                error: taskResult.result?.error || taskResult.message || 'Unknown error',
                details: taskResult.result
              },
              traceId
            );
          }
          
          return {
            taskId: response.data.task_id,
            businessId,
            status: finalStatus,
            result: taskResult.result || null,
            error: taskResult.result?.error || taskResult.message || null,
            screenshot: taskResult.result?.screenshot || null,
            traceId: traceId,
            startTime: startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            screenshots: taskResult.screenshots || [],
          };
        } else {
          // Task did not complete in the expected time
          logBrowserOperation(
            OperationCategory.TASK, 
            `Task ${response.data.task_id} timed out after ${maxAttempts} polling attempts`,
            LogLevel.ERROR,
            undefined,
            traceId
          );
          
          return {
            taskId: response.data.task_id,
            businessId,
            status: 'failed',
            error: 'Task did not complete in the allocated time',
            traceId: traceId,
            startTime: startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
          };
        }
      } else {
        // Handle invalid API response
        logBrowserOperation(
          OperationCategory.API, 
          `Invalid API response - missing task_id`,
          LogLevel.ERROR,
          response.data,
          traceId
        );
        
        return {
          taskId: 'error',
          businessId,
          status: 'failed',
          error: 'Invalid response from browser automation service',
          traceId: traceId,
          startTime: startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      logBrowserOperation(
        OperationCategory.AUTH, 
        `Authentication error for business ${businessId}`,
        LogLevel.ERROR,
        error,
        traceId
      );
      
      if (error.response) {
        logBrowserOperation(
          OperationCategory.API, 
          `API error status: ${error.response.status}`,
          LogLevel.ERROR,
          error.response.data,
          traceId
        );
      }
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during authentication',
        traceId: traceId,
        startTime: Date.now() - 1000, // Approximate start time
        endTime: Date.now(),
        duration: 1000, // Approximate duration
      };
    }
  }

  /**
   * DEPRECATED: Check the status of a running task
   * This method is no longer functional as we've migrated to direct API integration.
   * 
   * @param taskId The ID of the task to check
   */
  public async checkTaskStatus(taskId: string): Promise<BrowserTaskResult> {
    console.warn('[DEPRECATED] checkTaskStatus method is no longer functional. Application has migrated to direct API integration.');
    
    return {
      taskId,
      businessId: 'unknown',
      status: 'failed',
      error: 'Browser automation has been deprecated. Application now uses direct API integration.',
      traceId: `deprecated-${taskId}-${Date.now()}`
    };
  }

  /**
   * DEPRECATED: Get screenshot from a task
   * This method is no longer functional as we've migrated to direct API integration.
   * 
   * @param taskId The ID of the task
   * @param businessId The business ID
   * @param screenshotType The type of screenshot to retrieve (default: 'final_state')
   */
  public async getScreenshot(
    taskId: string, 
    businessId: string, 
    screenshotType: string = 'final_state'
  ): Promise<string | null> {
    console.warn('[DEPRECATED] getScreenshot method is no longer functional. Application has migrated to direct API integration.');
    return null;
  }
  
  /**
   * DEPRECATED: Get all available screenshots for a task
   * This method is no longer functional as we've migrated to direct API integration.
   * 
   * @param taskId The ID of the task
   * @param businessId The business ID
   */
  public async getAllScreenshots(taskId: string, businessId: string): Promise<Record<string, string> | null> {
    console.warn('[DEPRECATED] getAllScreenshots method is no longer functional. Application has migrated to direct API integration.');
    return null;
  }

  /**
   * DEPRECATED: Perform a Google Business Profile update
   * This method is no longer functional as we've migrated to direct API integration.
   * 
   * @param businessId The business ID
   * @param email Google account email
   * @param password Google account password
   * @param updateData The data to update on the profile
   */
  public async updateBusinessProfile(
    businessId: string,
    email: string,
    password: string,
    updateData: Record<string, any>
  ): Promise<BrowserTaskResult> {
    console.warn('[DEPRECATED] updateBusinessProfile method is no longer functional. Application has migrated to direct API integration.');
    
    return {
      taskId: `deprecated-${Date.now()}`,
      businessId,
      status: 'failed',
      error: 'Browser automation has been deprecated. Application now uses direct API integration.',
      traceId: `deprecated-${businessId}-${Date.now()}`
    };
  }

  /**
   * DEPRECATED: Create a new post on Google Business Profile
   * This method is no longer functional as we've migrated to direct API integration.
   * 
   * @param businessId The business ID
   * @param email Google account email
   * @param password Google account password
   * @param postData The post data (text, image, etc.)
   */
  public async createBusinessPost(
    businessId: string,
    email: string,
    password: string,
    postData: {
      text: string;
      imageUrl?: string;
      buttonText?: string;
      buttonUrl?: string;
    }
  ): Promise<BrowserTaskResult> {
    console.warn('[DEPRECATED] createBusinessPost method is no longer functional. Application has migrated to direct API integration.');
    
    return {
      taskId: `deprecated-${Date.now()}`,
      businessId,
      status: 'failed',
      error: 'Browser automation has been deprecated. Application now uses direct API integration.',
      traceId: `deprecated-${businessId}-${Date.now()}`
    };
  }

  /**
   * DEPRECATED: Check health status of the browser-use API
   */
  public async checkHealth(): Promise<boolean> {
    console.warn('[DEPRECATED] checkHealth method is no longer functional. Application has migrated to direct API integration.');
    return false;
  }
  
  /**
   * DEPRECATED: Check if an authenticated session exists for a business
   * @param businessId The business ID to check
   */
  public async checkSession(businessId: string): Promise<{
    hasSession: boolean;
    isExpired?: boolean;
    lastUpdated?: string;
    cookiesCount?: number;
  }> {
    console.warn('[DEPRECATED] checkSession method is no longer functional. Application has migrated to direct API integration.');
    return { hasSession: false };
  }
  
  /**
   * DEPRECATED: Validate if a session is still active and can be used
   * @param businessId The business ID to validate
   */
  public async validateSession(businessId: string): Promise<{
    valid: boolean;
    screenshot?: string;
    message?: string;
  }> {
    console.warn('[DEPRECATED] validateSession method is no longer functional. Application has migrated to direct API integration.');
    return { valid: false, message: 'Browser automation has been deprecated' };
  }
  
  /**
   * DEPRECATED: Refresh a session to keep it active
   * @param businessId The business ID to refresh
   */
  private async refreshSession(businessId: string): Promise<boolean> {
    console.warn('[DEPRECATED] refreshSession method is no longer functional. Application has migrated to direct API integration.');
    return false;
  }
}