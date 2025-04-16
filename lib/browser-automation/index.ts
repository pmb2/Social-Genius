import axios from 'axios';
import { BrowserAutomationConfig } from './config';

// Import logging utility
import { 
  logBrowserOperation, 
  LogLevel, 
  OperationCategory 
} from '../utilities/browser-logging';

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
}

// Browser Automation Service
export class BrowserAutomationService {
  private static instance: BrowserAutomationService;

  private constructor() {}

  public static getInstance(): BrowserAutomationService {
    if (!BrowserAutomationService.instance) {
      BrowserAutomationService.instance = new BrowserAutomationService();
    }
    return BrowserAutomationService.instance;
  }

  /**
   * Authenticate with Google using browser automation
   * @param businessId The business ID to associate with this authentication session
   * @param email Google account email
   * @param password Google account password
   * @param options Additional authentication options
   */
  public async authenticateGoogle(
    businessId: string,
    email: string,
    password: string,
    options?: {
      reuseSession?: boolean;
      persistSession?: boolean;
    }
  ): Promise<BrowserTaskResult> {
    const reuseSession = options?.reuseSession !== false; // Default to true
    const persistSession = options?.persistSession !== false; // Default to true
    
    try {
      // Add more visible logging with clear prefix and timestamp
      const timestamp = new Date().toISOString();
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - 🚀 STARTING GOOGLE AUTHENTICATION`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Business ID: ${businessId}`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - User email: ${email}`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Reuse session: ${reuseSession}`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Persist session: ${persistSession}`);
      
      logBrowserOperation(
        OperationCategory.AUTH, 
        `Starting Google authentication for business ID: ${businessId}, email: ${email}`,
        LogLevel.INFO
      );
      
      // First, check if we have a valid existing session if reuse is enabled
      if (reuseSession) {
        logBrowserOperation(
          OperationCategory.SESSION,
          `Checking for existing session for business ${businessId}`,
          LogLevel.INFO
        );
        
        // Check if we have a session
        const sessionCheck = await this.checkSession(businessId);
        
        // If we have a session and it's not marked as expired, validate it
        if (sessionCheck.hasSession && !sessionCheck.isExpired) {
          logBrowserOperation(
            OperationCategory.SESSION,
            `Found existing session for business ${businessId}, validating...`,
            LogLevel.INFO
          );
          
          // Validate session
          const validation = await this.validateSession(businessId);
          
          // If the session is valid, we can use it
          if (validation.valid) {
            logBrowserOperation(
              OperationCategory.SESSION,
              `Successfully reused existing valid session for business ${businessId}`,
              LogLevel.INFO
            );
            
            // Return success result with reused session
            return {
              taskId: `reused-${Date.now()}`,
              businessId,
              status: 'success',
              result: {
                reusedSession: true,
                message: 'Successfully reused existing Google session',
                validationScreenshot: validation.screenshot
              }
            };
          }
          
          logBrowserOperation(
            OperationCategory.SESSION,
            `Existing session for business ${businessId} is invalid, creating new login session`,
            LogLevel.WARN
          );
        }
      }
      
      // Add thorough API connection logging with timestamp
      const apiUrl = BrowserAutomationConfig.apiUrl;
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - 🔌 CONNECTING TO BROWSER API`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - API URL: ${apiUrl}`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - API Timeout: ${BrowserAutomationConfig.timeouts.auth}ms`);
      
      // Check environment variables that might affect the connection
      const envVars = {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        BROWSER_API_URL: process.env.BROWSER_API_URL || 'not set',
        BROWSER_API_PORT: process.env.BROWSER_API_PORT || 'not set'
      };
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Environment variables:`, JSON.stringify(envVars));
      
      // Try to ping the API to confirm accessibility
      try {
        const pingStart = Date.now();
        console.log(`[BROWSER_AUTOMATION] ${timestamp} - Pinging API before auth request...`);
        const healthUrl = BrowserAutomationConfig.getEndpointUrl('health');
        console.log(`[BROWSER_AUTOMATION] ${timestamp} - Health URL: ${healthUrl}`);
        
        // Only wait 3 seconds for the health check
        const healthResponse = await axios.get(healthUrl, { timeout: 3000 })
          .catch(error => {
            console.error(`[BROWSER_AUTOMATION] ${timestamp} - API health check failed:`, error.message);
            return { data: { status: 'unhealthy', error: error.message } };
          });
        
        const pingTime = Date.now() - pingStart;
        console.log(`[BROWSER_AUTOMATION] ${timestamp} - API health check result: ${healthResponse?.data?.status || 'unknown'} (${pingTime}ms)`);
      } catch (pingError) {
        console.error(`[BROWSER_AUTOMATION] ${timestamp} - Error pinging API:`, pingError.message);
      }
      
      logBrowserOperation(
        OperationCategory.API, 
        `Connecting to Browser-Use API at ${apiUrl}`,
        LogLevel.INFO
      );
      
      // Use the correct endpoint from the Browser Use API
      const requestData = {
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
          reuse_session: reuseSession
        }
      };
      
      logBrowserOperation(
        OperationCategory.API, 
        'Sending auth request with options',
        LogLevel.INFO,
        requestData // Will be automatically sanitized
      );
      
      // Start timing the request
      const startTime = Date.now();
      const authEndpoint = BrowserAutomationConfig.getEndpointUrl('googleAuth');
      
      // Log detailed information about the request
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - 📡 SENDING AUTH REQUEST`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Endpoint: ${authEndpoint}`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Method: POST`);
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Request timeout: ${BrowserAutomationConfig.timeouts.auth + 5000}ms`);
      
      // Test browser API connectivity with a ping
      try {
        const pingStart = Date.now();
        console.log(`[BROWSER_AUTOMATION] ${timestamp} - Testing API connectivity...`);
        
        // Simple connectivity check 
        const pingResponse = await axios.options(authEndpoint, { 
          timeout: 2000 
        }).catch(error => {
          console.error(`[BROWSER_AUTOMATION] ${timestamp} - ⚠️ API ping failed: ${error.message}`);
          if (error.code) {
            console.error(`[BROWSER_AUTOMATION] ${timestamp} - Error code: ${error.code}`);
          }
          if (error.syscall) {
            console.error(`[BROWSER_AUTOMATION] ${timestamp} - Error syscall: ${error.syscall}`);
          }
          return null;
        });
        
        const pingTime = pingResponse ? Date.now() - pingStart : -1;
        console.log(`[BROWSER_AUTOMATION] ${timestamp} - API connectivity: ${pingResponse ? `OK (${pingTime}ms)` : 'FAILED'}`);
      } catch (error) {
        console.error(`[BROWSER_AUTOMATION] ${timestamp} - ⚠️ API connectivity test error: ${error.message}`);
      }
      
      // Use the endpoint from config
      console.log(`[BROWSER_AUTOMATION] ${timestamp} - Sending auth request...`);
      const response = await axios.post(
        BrowserAutomationConfig.getEndpointUrl('googleAuth'), 
        {
          businessId,
          email,
          password, // Send actual password to API
          taskType: 'login',
          timeout: BrowserAutomationConfig.timeouts.auth,
          reuseSession: reuseSession,
          advanced_options: {
            human_delay_min: 1,
            human_delay_max: 3,
            max_captcha_attempts: 2,
            persist_session: persistSession,
            reuse_session: reuseSession
          }
        },
        {
          // Add timeout to request
          timeout: BrowserAutomationConfig.timeouts.auth + 5000 // Add 5s buffer
        }
      );
      
      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;
        // The API returns a task_id for asynchronous processing
        logBrowserOperation(
          OperationCategory.TASK, 
          `Auth task initiated successfully with task ID: ${taskId}`,
          LogLevel.INFO
        );
        
        logBrowserOperation(
          OperationCategory.API, 
          `Response received in ${Date.now() - startTime}ms`,
          LogLevel.INFO
        );
        
        // Poll for task completion
        let attempts = 0;
        const maxAttempts = BrowserAutomationConfig.polling.maxAttempts;
        let taskResult = null;
        
        logBrowserOperation(
          OperationCategory.TASK, 
          `Polling for task completion (max ${maxAttempts} attempts)...`,
          LogLevel.INFO
        );
        
        while (attempts < maxAttempts) {
          attempts++;
          
          try {
            // Check task status
            logBrowserOperation(
              OperationCategory.TASK, 
              `Polling attempt ${attempts}/${maxAttempts} for task ${taskId}`,
              LogLevel.INFO
            );
            
            const statusUrl = BrowserAutomationConfig.getEndpointUrl('taskStatus') + `/${taskId}`;
            const statusResponse = await axios.get(statusUrl, {
              timeout: BrowserAutomationConfig.timeouts.request
            });
            
            logBrowserOperation(
              OperationCategory.TASK, 
              `Status response received: ${statusResponse.data.status}`,
              LogLevel.INFO
            );
            
            if (statusResponse.data.status === 'completed' || statusResponse.data.status === 'failed') {
              taskResult = statusResponse.data;
              logBrowserOperation(
                OperationCategory.TASK, 
                `Task ${taskId} ${statusResponse.data.status} after ${attempts} attempts`,
                LogLevel.INFO
              );
              
              // Log additional details for failed tasks
              if (statusResponse.data.status === 'failed') {
                logBrowserOperation(
                  OperationCategory.TASK, 
                  `Task failed with error: ${statusResponse.data.message || 'Unknown error'}`,
                  LogLevel.ERROR,
                  statusResponse.data.result
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
              LogLevel.INFO
            );
            
            // Wait before checking again with exponential backoff
            await new Promise(resolve => setTimeout(resolve, nextPollInterval));
          } catch (pollError) {
            logBrowserOperation(
              OperationCategory.TASK, 
              `Error polling task ${taskId} status (attempt ${attempts})`,
              LogLevel.ERROR,
              pollError
            );
            
            // Calculate backoff interval with jitter even for errors
            const baseInterval = BrowserAutomationConfig.polling.interval;
            const exponentialDelay = baseInterval * Math.pow(2, attempts - 1);
            const jitter = Math.random() * baseInterval * 0.1;
            const nextPollInterval = Math.min(exponentialDelay + jitter, 30000);
            
            logBrowserOperation(
              OperationCategory.TASK, 
              `Waiting ${Math.round(nextPollInterval)}ms before retry after error (exponential backoff)`,
              LogLevel.INFO
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
            LogLevel.INFO
          );
          
          if (finalStatus === 'success') {
            logBrowserOperation(
              OperationCategory.AUTH, 
              `Google authentication successful for business ${businessId}`,
              LogLevel.INFO
            );
            
            // Check if we have screenshot data
            if (taskResult.result?.screenshot) {
              logBrowserOperation(
                OperationCategory.TASK, 
                `Screenshot captured successfully`,
                LogLevel.INFO
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
              }
            );
          }
          
          return {
            taskId: response.data.task_id,
            businessId,
            status: finalStatus,
            result: taskResult.result || null,
            error: taskResult.result?.error || taskResult.message || null,
            screenshot: taskResult.result?.screenshot || null
          };
        } else {
          // Task did not complete in the expected time
          logBrowserOperation(
            OperationCategory.TASK, 
            `Task ${response.data.task_id} timed out after ${maxAttempts} polling attempts`,
            LogLevel.ERROR
          );
          
          return {
            taskId: response.data.task_id,
            businessId,
            status: 'failed',
            error: 'Task did not complete in the allocated time'
          };
        }
      } else {
        // Handle invalid API response
        logBrowserOperation(
          OperationCategory.API, 
          `Invalid API response - missing task_id`,
          LogLevel.ERROR,
          response.data
        );
        
        return {
          taskId: 'error',
          businessId,
          status: 'failed',
          error: 'Invalid response from browser automation service'
        };
      }
    } catch (error: any) {
      logBrowserOperation(
        OperationCategory.AUTH, 
        `Authentication error for business ${businessId}`,
        LogLevel.ERROR,
        error
      );
      
      if (error.response) {
        logBrowserOperation(
          OperationCategory.API, 
          `API error status: ${error.response.status}`,
          LogLevel.ERROR,
          error.response.data
        );
      }
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during authentication'
      };
    }
  }

  /**
   * Check the status of a running task
   * @param taskId The ID of the task to check
   */
  public async checkTaskStatus(taskId: string): Promise<BrowserTaskResult> {
    try {
      logBrowserOperation(
        OperationCategory.TASK, 
        `Checking status of task: ${taskId}`,
        LogLevel.INFO
      );
      
      const statusUrl = BrowserAutomationConfig.getEndpointUrl('taskStatus') + `/${taskId}`;
      const response = await axios.get(statusUrl, {
        timeout: BrowserAutomationConfig.timeouts.request
      });
      
      logBrowserOperation(
        OperationCategory.TASK, 
        `Task status retrieved: ${response.data.status}`,
        LogLevel.INFO
      );
      
      return {
        taskId,
        businessId: response.data.businessId,
        status: response.data.status,
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.TASK, 
        `Task status check error for task ${taskId}`,
        LogLevel.ERROR,
        error
      );
      
      return {
        taskId,
        businessId: 'unknown',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error checking task status'
      };
    }
  }

  /**
   * Get screenshot from a task
   * @param taskId The ID of the task
   * @param businessId The business ID
   * @param screenshotType The type of screenshot to retrieve (default: 'final_state')
   */
  public async getScreenshot(
    taskId: string, 
    businessId: string, 
    screenshotType: string = 'final_state'
  ): Promise<string | null> {
    try {
      logBrowserOperation(
        OperationCategory.TASK, 
        `Retrieving ${screenshotType} screenshot for task ${taskId}, business ${businessId}`,
        LogLevel.INFO
      );
      
      const screenshotUrl = `${BrowserAutomationConfig.getEndpointUrl('screenshot')}/${businessId}/${taskId}/${screenshotType}`;
      const response = await axios.get(screenshotUrl, {
        responseType: 'arraybuffer',
        timeout: BrowserAutomationConfig.timeouts.request
      });
      
      // Convert array buffer to base64
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      
      logBrowserOperation(
        OperationCategory.TASK, 
        `Screenshot (${screenshotType}) retrieved successfully (${(response.data.length/1024).toFixed(1)}KB)`,
        LogLevel.INFO
      );
      
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      logBrowserOperation(
        OperationCategory.TASK, 
        `Screenshot (${screenshotType}) retrieval error for task ${taskId}`,
        LogLevel.ERROR,
        error
      );
      
      return null;
    }
  }
  
  /**
   * Get all available screenshots for a task
   * @param taskId The ID of the task
   * @param businessId The business ID
   */
  public async getAllScreenshots(taskId: string, businessId: string): Promise<Record<string, string> | null> {
    try {
      logBrowserOperation(
        OperationCategory.TASK, 
        `Retrieving all screenshots for task ${taskId}, business ${businessId}`,
        LogLevel.INFO
      );
      
      // Get the list of available screenshots first
      const listUrl = `${BrowserAutomationConfig.getEndpointUrl('screenshotList')}/${businessId}/${taskId}`;
      const listResponse = await axios.get(listUrl, {
        timeout: BrowserAutomationConfig.timeouts.request
      });
      
      if (!listResponse.data || !Array.isArray(listResponse.data.screenshots)) {
        logBrowserOperation(
          OperationCategory.TASK, 
          `No screenshots found for task ${taskId}`,
          LogLevel.WARN
        );
        return null;
      }
      
      const availableScreenshots = listResponse.data.screenshots as string[];
      logBrowserOperation(
        OperationCategory.TASK, 
        `Found ${availableScreenshots.length} screenshots for task ${taskId}`,
        LogLevel.INFO
      );
      
      // Download each screenshot
      const screenshots: Record<string, string> = {};
      const downloadPromises = availableScreenshots.map(async (screenshotName) => {
        try {
          const screenshotUrl = `${BrowserAutomationConfig.getEndpointUrl('screenshot')}/${businessId}/${taskId}/${screenshotName}`;
          const response = await axios.get(screenshotUrl, {
            responseType: 'arraybuffer',
            timeout: BrowserAutomationConfig.timeouts.request
          });
          
          // Convert to base64
          const base64 = Buffer.from(response.data, 'binary').toString('base64');
          screenshots[screenshotName] = `data:image/png;base64,${base64}`;
          
          logBrowserOperation(
            OperationCategory.TASK, 
            `Retrieved screenshot ${screenshotName} (${(response.data.length/1024).toFixed(1)}KB)`,
            LogLevel.INFO
          );
        } catch (error) {
          logBrowserOperation(
            OperationCategory.TASK, 
            `Failed to retrieve screenshot ${screenshotName}`,
            LogLevel.ERROR,
            error
          );
        }
      });
      
      // Wait for all downloads to complete
      await Promise.all(downloadPromises);
      
      return screenshots;
    } catch (error) {
      logBrowserOperation(
        OperationCategory.TASK, 
        `Error retrieving screenshots for task ${taskId}`,
        LogLevel.ERROR,
        error
      );
      
      return null;
    }
  }

  /**
   * Perform a Google Business Profile update
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
    try {
      logBrowserOperation(
        OperationCategory.API,
        `Updating business profile for business ${businessId}`,
        LogLevel.INFO,
        { businessId, email, updateDataFields: Object.keys(updateData) }
      );
      
      const response = await axios.post(
        BrowserAutomationConfig.getEndpointUrl('profileUpdate'),
        {
          businessId,
          email,
          password,
          taskType: 'info',
          additionalData: updateData,
          timeout: BrowserAutomationConfig.timeouts.profileUpdate
        },
        {
          timeout: BrowserAutomationConfig.timeouts.profileUpdate + 5000 // Add 5s buffer
        }
      );
      
      logBrowserOperation(
        OperationCategory.API,
        `Profile update request successful, task ID: ${response.data.taskId || 'unknown'}`,
        LogLevel.INFO
      );
      
      return {
        taskId: response.data.taskId,
        businessId,
        status: response.data.success ? 'success' : 'failed',
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.API,
        `Business profile update error for business ${businessId}`,
        LogLevel.ERROR,
        error
      );
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during profile update'
      };
    }
  }

  /**
   * Create a new post on Google Business Profile
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
    try {
      logBrowserOperation(
        OperationCategory.API,
        `Creating business post for business ${businessId}`,
        LogLevel.INFO,
        { 
          businessId, 
          email, 
          postLength: postData.text?.length || 0,
          hasImage: !!postData.imageUrl,
          hasButton: !!(postData.buttonText && postData.buttonUrl)
        }
      );
      
      const response = await axios.post(
        BrowserAutomationConfig.getEndpointUrl('postCreation'),
        {
          businessId,
          email,
          password,
          taskType: 'post',
          additionalData: postData,
          timeout: BrowserAutomationConfig.timeouts.postCreation
        },
        {
          timeout: BrowserAutomationConfig.timeouts.postCreation + 5000 // Add 5s buffer
        }
      );
      
      logBrowserOperation(
        OperationCategory.API,
        `Post creation request successful, task ID: ${response.data.taskId || 'unknown'}`,
        LogLevel.INFO
      );
      
      return {
        taskId: response.data.taskId,
        businessId,
        status: response.data.success ? 'success' : 'failed',
        result: response.data.result,
        error: response.data.error,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.API,
        `Business post creation error for business ${businessId}`,
        LogLevel.ERROR,
        error
      );
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error during post creation'
      };
    }
  }

  /**
   * Check health status of the browser-use API
   */
  public async checkHealth(): Promise<boolean> {
    try {
      logBrowserOperation(
        OperationCategory.API,
        `Checking API health status at ${BrowserAutomationConfig.apiUrl}`,
        LogLevel.INFO
      );
      
      const response = await axios.get(
        BrowserAutomationConfig.getEndpointUrl('health'),
        {
          timeout: 5000 // Short timeout for health check
        }
      );
      
      const isHealthy = response.data.status === 'healthy';
      
      logBrowserOperation(
        OperationCategory.API,
        `API health check result: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`,
        isHealthy ? LogLevel.INFO : LogLevel.ERROR,
        response.data
      );
      
      return isHealthy;
    } catch (error) {
      logBrowserOperation(
        OperationCategory.API,
        `API health check failed`,
        LogLevel.ERROR,
        error
      );
      
      return false;
    }
  }
  
  /**
   * Check if an authenticated session exists for a business
   * @param businessId The business ID to check
   */
  public async checkSession(businessId: string): Promise<{
    hasSession: boolean;
    isExpired?: boolean;
    lastUpdated?: string;
    cookiesCount?: number;
  }> {
    try {
      logBrowserOperation(
        OperationCategory.SESSION,
        `Checking for existing session for business ${businessId}`,
        LogLevel.INFO
      );
      
      const sessionCheckUrl = `${BrowserAutomationConfig.getEndpointUrl('session')}/${businessId}`;
      
      const response = await axios.get(sessionCheckUrl, {
        timeout: BrowserAutomationConfig.timeouts.request
      });
      
      const hasSession = response.data.has_session === true;
      
      logBrowserOperation(
        OperationCategory.SESSION,
        `Session check for business ${businessId}: ${hasSession ? 'EXISTS' : 'NOT FOUND'}`,
        LogLevel.INFO,
        hasSession ? {
          cookiesCount: response.data.cookies_count,
          lastUpdated: response.data.last_updated,
          isExpired: response.data.is_expired
        } : null
      );
      
      return {
        hasSession,
        isExpired: response.data.is_expired,
        lastUpdated: response.data.last_updated,
        cookiesCount: response.data.cookies_count
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.SESSION,
        `Error checking session for business ${businessId}`,
        LogLevel.ERROR,
        error
      );
      
      return { 
        hasSession: false
      };
    }
  }
  
  /**
   * Validate if a session is still active and can be used
   * @param businessId The business ID to validate
   */
  public async validateSession(businessId: string): Promise<{
    valid: boolean;
    screenshot?: string;
    message?: string;
  }> {
    try {
      logBrowserOperation(
        OperationCategory.SESSION,
        `Validating session for business ${businessId}`,
        LogLevel.INFO
      );
      
      const validationUrl = `${BrowserAutomationConfig.getEndpointUrl('session')}/${businessId}/validate`;
      
      const response = await axios.get(validationUrl, {
        timeout: BrowserAutomationConfig.timeouts.request * 2 // Double the timeout for validation
      });
      
      const isValid = response.data.valid === true;
      
      logBrowserOperation(
        OperationCategory.SESSION,
        `Session validation for business ${businessId}: ${isValid ? 'VALID' : 'INVALID'}`,
        isValid ? LogLevel.INFO : LogLevel.WARN,
        {
          message: response.data.message,
          screenshot: response.data.screenshot
        }
      );
      
      // If session is valid, schedule a background refresh to keep it fresh
      if (isValid) {
        setTimeout(() => {
          this.refreshSession(businessId).catch(error => {
            logBrowserOperation(
              OperationCategory.SESSION,
              `Error in background session refresh for ${businessId}`,
              LogLevel.ERROR,
              error
            );
          });
        }, 5 * 60 * 1000); // Refresh after 5 minutes
      }
      
      return {
        valid: isValid,
        message: response.data.message,
        screenshot: response.data.screenshot
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.SESSION,
        `Error validating session for business ${businessId}`,
        LogLevel.ERROR,
        error
      );
      
      return { 
        valid: false,
        message: error instanceof Error ? error.message : 'Unknown error during session validation'
      };
    }
  }
  
  /**
   * Refresh a session to keep it active
   * @param businessId The business ID to refresh
   */
  private async refreshSession(businessId: string): Promise<boolean> {
    try {
      // Just use the validate session endpoint, which will refresh the session if valid
      const validation = await this.validateSession(businessId);
      return validation.valid;
    } catch (error) {
      logBrowserOperation(
        OperationCategory.SESSION,
        `Error refreshing session for business ${businessId}`,
        LogLevel.ERROR,
        error
      );
      
      return false;
    }
  }
}