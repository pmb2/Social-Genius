/**
 * Browser Automation Service Bridge
 * 
 * Provides integration between the BrowserAutomationService and browser-manager.ts
 * for seamless browser automation operations across the application.
 * 
 * Features:
 * - Unified authentication interface
 * - Fallback mechanisms for improved reliability
 * - Detailed logging and tracing for debugging
 * - Performance monitoring
 */

import { BrowserAutomationService, BrowserTaskResult } from '@/lib/browser-automation';
import { BrowserAutomationConfig } from '@/lib/browser-automation/config';
import { 
  logBrowserOperation, 
  LogLevel, 
  OperationCategory,
  generateTraceId,
  createFunctionContext,
  measurePerformance
} from '@/lib/utilities/browser-logging';
import { EncryptedCredential, unwrapCredentials } from '@/lib/utilities/credentials-manager';

// Optional import for direct browser manager integration
let browserManager: any = null;

/**
 * Load the browser manager module if available
 */
async function loadBrowserManager(): Promise<any> {
  if (browserManager !== null) {
    return browserManager;
  }
  
  try {
    // Dynamic import to avoid circular dependencies
    const module = await import('@/services/compliance/browser-manager');
    browserManager = module.default || module;
    return browserManager;
  } catch (error) {
    logBrowserOperation(
      OperationCategory.BROWSER,
      'Failed to load browser manager module',
      LogLevel.WARN,
      error
    );
    return null;
  }
}

/**
 * Load the consolidated auth service if available
 */
async function loadConsolidatedAuthService(): Promise<any> {
  try {
    // Dynamic import to avoid circular dependencies
    const { ComplianceAuthService } = await import('@/services/compliance/consolidated-auth-service');
    return new ComplianceAuthService();
  } catch (error) {
    logBrowserOperation(
      OperationCategory.AUTH,
      'Failed to load consolidated auth service',
      LogLevel.WARN,
      error
    );
    return null;
  }
}

/**
 * Create a task result from browser manager result
 * 
 * @param result The result from the browser manager
 * @param businessId The business ID
 * @param taskId The task ID
 * @param traceId Optional trace ID for cross-component tracking
 * @param startTime Optional start time for tracking duration
 * @returns Standardized BrowserTaskResult
 */
function createTaskResultFromBrowserManager(
  result: any,
  businessId: string,
  taskId: string,
  traceId?: string,
  startTime?: number
): BrowserTaskResult {
  const isSuccess = result?.success === true;
  const endTime = Date.now();
  
  return {
    taskId,
    businessId,
    status: isSuccess ? 'success' : 'failed',
    result: isSuccess ? result : null,
    error: isSuccess ? null : (result?.error || 'Unknown error'),
    screenshot: result?.screenshot || null,
    traceId,
    startTime,
    endTime,
    duration: startTime ? endTime - startTime : undefined
  };
}

/**
 * Browser operation service that provides a unified interface to browser
 * automation capabilities by bridging BrowserAutomationService and browser-manager.
 */
export class BrowserOperationService {
  private static instance: BrowserOperationService;
  private automationService: BrowserAutomationService;
  
  // Private constructor enforces singleton pattern
  private constructor() {
    this.automationService = BrowserAutomationService.getInstance();
  }
  
  /**
   * Get the singleton instance of the browser operation service
   */
  public static getInstance(): BrowserOperationService {
    if (!BrowserOperationService.instance) {
      BrowserOperationService.instance = new BrowserOperationService();
    }
    return BrowserOperationService.instance;
  }
  
  /**
   * Check the health of the browser automation system with detailed diagnostics
   * and retry capability
   */
  public async checkHealth(
    options: { maxRetries?: number; retryDelay?: number } = {}
  ): Promise<{
    externalServiceHealthy: boolean;
    browserManagerAvailable: boolean;
    overallHealthy: boolean;
    browserDetails?: {
      instanceCount?: number;
      activeInstances?: number;
      connectionTime?: number;
      memoryUsage?: string;
    };
    diagnostics?: {
      apiEndpointReachable?: boolean;
      apiResponseTime?: number;
      lastError?: string;
      connectionAttempts?: number;
    };
  }> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    let attempts = 0;
    let lastError: Error | null = null;
    let diagnostics: any = {};
    
    logBrowserOperation(
      OperationCategory.BROWSER,
      'Checking browser system health with enhanced diagnostics',
      LogLevel.INFO
    );
    
    // Loop through retries
    while (attempts < maxRetries) {
      attempts++;
      
      try {
        // Start timing for diagnostics
        const startTime = Date.now();
        
        // Check the external service health with timeout
        let externalServiceHealthy = false;
        try {
          // Try to ping the API with a fast timeout first
          externalServiceHealthy = await Promise.race([
            this.automationService.checkHealth(),
            new Promise<boolean>((_, reject) => 
              setTimeout(() => reject(new Error('API health check timeout')), 5000)
            )
          ]);
          
          // Record API response time
          diagnostics.apiResponseTime = Date.now() - startTime;
          diagnostics.apiEndpointReachable = true;
        } catch (apiError) {
          // Record API diagnostic information
          diagnostics.apiEndpointReachable = false;
          diagnostics.apiResponseTime = Date.now() - startTime;
          diagnostics.lastError = apiError instanceof Error ? 
            apiError.message : 'Unknown API error';
            
          logBrowserOperation(
            OperationCategory.API,
            `API health check failed: ${diagnostics.lastError}`,
            LogLevel.WARN
          );
        }
        
        // Check if the browser manager is available with enhanced info
        const browserManagerModule = await loadBrowserManager();
        const browserManagerAvailable = !!browserManagerModule;
        
        // Collect detailed browser manager statistics if available
        let browserDetails: any = {};
        if (browserManagerAvailable && browserManagerModule.BrowserInstanceManager) {
          try {
            // Try to get instance of browser manager
            const instanceManager = browserManagerModule.BrowserInstanceManager;
            
            // Only proceed if the instance manager is properly initialized
            if (typeof instanceManager.getInstanceCount === 'function') {
              // Record instance counts
              browserDetails.instanceCount = instanceManager.getInstanceCount();
              browserDetails.activeInstances = instanceManager.getActiveInstanceCount();
              
              // Test browser instance creation capability
              const testStartTime = Date.now();
              const testKey = `health-check-${Date.now()}`;
              
              try {
                // Try creating a test instance with short timeout
                await Promise.race([
                  instanceManager.getOrCreateInstance(testKey),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Browser instance creation timeout')), 10000)
                  )
                ]);
                
                // Record browser instance creation time
                browserDetails.connectionTime = Date.now() - testStartTime;
                
                // Clean up test instance
                await instanceManager.removeInstance(testKey);
              } catch (browserError) {
                browserDetails.lastError = browserError instanceof Error ? 
                  browserError.message : 'Unknown browser error';
                  
                logBrowserOperation(
                  OperationCategory.BROWSER,
                  `Browser instance creation test failed: ${browserDetails.lastError}`,
                  LogLevel.WARN
                );
              }
              
              // Try to get memory usage
              try {
                const memoryUsage = process.memoryUsage();
                const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
                const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
                browserDetails.memoryUsage = `${heapUsed}MB used of ${heapTotal}MB total`;
              } catch (memoryError) {
                // Non-critical error, continue
                browserDetails.memoryUsage = 'Unable to determine';
              }
            }
          } catch (managerError) {
            browserDetails.error = managerError instanceof Error ? 
              managerError.message : 'Unknown browser manager error';
              
            logBrowserOperation(
              OperationCategory.BROWSER,
              `Error getting browser manager details: ${browserDetails.error}`,
              LogLevel.WARN
            );
          }
        }
        
        // Overall health depends on at least one system being available
        // and working properly
        const overallHealthy = externalServiceHealthy || 
          (browserManagerAvailable && !browserDetails.lastError);
        
        // Record attempt information in diagnostics
        diagnostics.connectionAttempts = attempts;
        
        // Log detailed health information
        logBrowserOperation(
          OperationCategory.BROWSER,
          `Browser system health: ${overallHealthy ? 'HEALTHY' : 'UNHEALTHY'}`,
          overallHealthy ? LogLevel.INFO : LogLevel.ERROR,
          {
            externalServiceHealthy,
            browserManagerAvailable,
            browserDetails,
            diagnostics
          }
        );
        
        return {
          externalServiceHealthy,
          browserManagerAvailable,
          overallHealthy,
          browserDetails,
          diagnostics
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logBrowserOperation(
          OperationCategory.BROWSER,
          `Health check attempt ${attempts}/${maxRetries} failed: ${lastError.message}`,
          LogLevel.WARN
        );
        
        // Only retry if we haven't reached max retries
        if (attempts < maxRetries) {
          logBrowserOperation(
            OperationCategory.BROWSER,
            `Retrying health check in ${retryDelay}ms...`,
            LogLevel.INFO
          );
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // If we reach here, all retries failed
    logBrowserOperation(
      OperationCategory.BROWSER,
      `All health check attempts failed after ${attempts} tries`,
      LogLevel.ERROR,
      lastError
    );
    
    return {
      externalServiceHealthy: false,
      browserManagerAvailable: false,
      overallHealthy: false,
      diagnostics: {
        connectionAttempts: attempts,
        lastError: lastError?.message || 'Unknown error'
      }
    };
  }
  
  /**
   * Authenticate with Google using browser automation
   * 
   * This method tries the external service first, then falls back to browser manager
   * if available, for maximum reliability.
   * 
   * @param businessId The business ID to associate with this authentication session
   * @param email Google account email
   * @param credentials Encrypted credentials or password string
   * @param traceId Optional trace ID for cross-component tracking
   */
  public async authenticateGoogle(
    businessId: string,
    email: string,
    credentials: string | EncryptedCredential,
    traceId?: string
  ): Promise<BrowserTaskResult> {
    // Generate a trace ID if one wasn't provided
    const authTraceId = traceId || generateTraceId(`auth-${businessId}`);
    
    // Create a function context for enhanced logging
    const { log, logEntry, logExit } = createFunctionContext(
      'authenticateGoogle',
      'service-bridge.ts',
      OperationCategory.AUTH,
      `auth-${businessId}`,
      authTraceId
    );
    
    // Log entry into this function
    logEntry({
      businessId,
      email,
      hasCredentials: !!credentials,
      timestamp: new Date().toISOString()
    });
    
    try {
      log(
        `Starting Google authentication process`,
        LogLevel.INFO,
        {
          businessId,
          email,
          credentialType: typeof credentials === 'string' ? 'plain' : 'encrypted'
        }
      );
      
      // Decrypt credentials if necessary
      const password = await measurePerformance(
        'Decrypt credentials',
        async () => {
          if (typeof credentials === 'string') {
            log(`Using plain string credentials`, LogLevel.INFO);
            return credentials;
          } else {
            log(`Decrypting credentials`, LogLevel.INFO);
            return unwrapCredentials(credentials);
          }
        },
        OperationCategory.SECURITY,
        authTraceId
      );
      
      if (!password) {
        log(`Failed to process credentials`, LogLevel.ERROR);
        
        const errorResult = {
          taskId: `error-${Date.now()}`,
          businessId,
          status: 'failed' as const,
          error: 'Failed to process credentials',
          traceId: authTraceId
        };
        
        logExit(errorResult);
        return errorResult;
      }
      
      // Try the external automation service first
      log(`Checking health of external automation service`, LogLevel.INFO);
      
      let externalServiceHealthy = false;
      await measurePerformance(
        'Check external service health',
        async () => {
          try {
            externalServiceHealthy = await this.automationService.checkHealth();
            log(`External automation service health check: ${externalServiceHealthy ? 'HEALTHY' : 'UNHEALTHY'}`, 
              externalServiceHealthy ? LogLevel.INFO : LogLevel.WARN
            );
          } catch (healthError) {
            log(`External automation service health check failed`, LogLevel.ERROR, { error: healthError });
            externalServiceHealthy = false;
          }
        },
        OperationCategory.API,
        authTraceId
      );
      
      // If external service is healthy, use it
      if (externalServiceHealthy) {
        log(`Using external automation service for authentication`, LogLevel.INFO);
        
        try {
          const result = await measurePerformance(
            'External service authentication',
            async () => this.automationService.authenticateGoogle(
              businessId,
              email,
              password
            ),
            OperationCategory.AUTH,
            authTraceId
          );
          
          // Add trace ID to the result
          const resultWithTrace = {
            ...result,
            traceId: authTraceId
          };
          
          log(`External service authentication completed`, 
            result.status === 'success' ? LogLevel.INFO : LogLevel.ERROR,
            {
              taskId: result.taskId,
              status: result.status,
              error: result.error
            }
          );
          
          logExit(resultWithTrace);
          return resultWithTrace;
        } catch (externalError) {
          log(`External authentication service failed`, LogLevel.ERROR, { error: externalError });
          // Proceed to fallback method
        }
      }
      
      // Fall back to browser manager if available
      log(`Attempting to load browser manager`, LogLevel.INFO);
      
      const browserManagerModule = await measurePerformance(
        'Load browser manager',
        loadBrowserManager,
        OperationCategory.BROWSER,
        authTraceId
      );
      
      if (browserManagerModule) {
        log(`Falling back to browser manager for authentication`, LogLevel.INFO);
        
        // Generate a unique task ID
        const taskId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        try {
          // Initialize a browser instance
          log(`Creating browser instance`, LogLevel.INFO);
          
          const browserInstance = await measurePerformance(
            'Create browser instance',
            async () => browserManagerModule.createBrowserInstance(
              businessId,
              { 
                headless: true, // Always use headless mode in server environment
                traceId: authTraceId
              }
            ),
            OperationCategory.BROWSER,
            authTraceId
          );
          
          if (!browserInstance) {
            throw new Error('Failed to create browser instance');
          }
          
          // Define login options
          const loginOptions = {
            emailSelector: '#Email, input[type="email"], input[name="identifier"]',
            emailNextSelector: '#next, button[type="submit"], #identifierNext',
            passwordSelector: '#Password, input[type="password"], input[name="password"]',
            passwordNextSelector: '#submit, button[type="submit"], #passwordNext',
            credentials: {
              email,
              password
            },
            successIndicator: 'myaccount.google.com', // URL fragment that indicates successful login
            captureScreenshots: true,
            traceId: authTraceId
          };
          
          // Perform login
          log(`Performing login with browser manager`, LogLevel.INFO);
          
          const result = await measurePerformance(
            'Browser manager login',
            async () => browserInstance.performLogin(loginOptions),
            OperationCategory.AUTH,
            authTraceId
          );
          
          // Convert result to standard format with trace ID
          const standardResult = createTaskResultFromBrowserManager(result, businessId, taskId);
          standardResult.traceId = authTraceId;
          
          log(`Browser manager authentication completed`, 
            standardResult.status === 'success' ? LogLevel.INFO : LogLevel.ERROR,
            {
              taskId: standardResult.taskId,
              status: standardResult.status,
              error: standardResult.error
            }
          );
          
          logExit(standardResult);
          return standardResult;
        } catch (browserManagerError) {
          log(`Browser manager authentication failed`, LogLevel.ERROR, { error: browserManagerError });
          
          const errorResult = {
            taskId: `error-${Date.now()}`,
            businessId,
            status: 'failed' as const,
            error: browserManagerError instanceof Error ? 
              browserManagerError.message : 
              'Unknown error during browser manager authentication',
            traceId: authTraceId
          };
          
          logExit(errorResult);
          return errorResult;
        }
      }
      
      // If we get here, both methods failed
      log(`All authentication methods failed`, LogLevel.ERROR);
      
      const failedResult = {
        taskId: `error-all-methods-${Date.now()}`,
        businessId,
        status: 'failed' as const,
        error: 'No available authentication methods',
        traceId: authTraceId
      };
      
      logExit(failedResult);
      return failedResult;
    } catch (error) {
      log(`Unexpected error during authentication`, LogLevel.ERROR, { error });
      
      const errorResult = {
        taskId: `error-unexpected-${Date.now()}`,
        businessId,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Unknown error during authentication',
        traceId: authTraceId
      };
      
      logExit(errorResult, error);
      return errorResult;
    }
  }
  
  /**
   * Check the status of a running task
   * 
   * This works with both external service tasks and browser manager tasks.
   * 
   * @param taskId The ID of the task to check
   * @param traceId Optional trace ID for cross-component tracking
   */
  public async checkTaskStatus(taskId: string, traceId?: string): Promise<BrowserTaskResult> {
    // Generate a trace ID if one wasn't provided
    const statusTraceId = traceId || generateTraceId(`status-${taskId}`);
    
    // Create a function context for enhanced logging
    const { log, logEntry, logExit } = createFunctionContext(
      'checkTaskStatus',
      'service-bridge.ts',
      OperationCategory.TASK,
      `status-${taskId}`,
      statusTraceId
    );
    
    // Log entry into this function
    logEntry({ taskId });
    
    try {
      // Start timing the status check
      const startTime = Date.now();
      
      // Check if this is a local task
      if (taskId.startsWith('local-')) {
        log(`Checking status of local task`, LogLevel.INFO);
        
        // For local tasks managed by browser manager, we need a different approach
        const browserManagerModule = await measurePerformance(
          'Load browser manager for status check',
          loadBrowserManager,
          OperationCategory.BROWSER,
          statusTraceId
        );
        
        if (browserManagerModule) {
          log(`Using browser manager to check task status`, LogLevel.INFO);
          
          const status = await measurePerformance(
            'Get task status from browser manager',
            async () => browserManagerModule.getTaskStatus(taskId),
            OperationCategory.TASK,
            statusTraceId
          );
          
          const result = {
            taskId,
            businessId: status.businessId || 'unknown',
            status: status.completed ? 
              (status.success ? 'success' : 'failed') : 
              'in_progress',
            result: status.result,
            error: status.error,
            screenshot: status.screenshot,
            traceId: statusTraceId,
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime
          };
          
          log(`Task status retrieved from browser manager`, LogLevel.INFO, {
            taskStatus: result.status,
            businessId: result.businessId,
            hasError: !!result.error
          });
          
          logExit(result);
          return result;
        }
        
        // If browser manager isn't available, return an error
        log(`Browser manager not available for local task`, LogLevel.ERROR);
        
        const errorResult = {
          taskId,
          businessId: 'unknown',
          status: 'failed' as const,
          error: 'Browser manager not available for local task',
          traceId: statusTraceId,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime
        };
        
        logExit(errorResult);
        return errorResult;
      }
      
      // For external service tasks, use the automation service
      log(`Checking status of external task`, LogLevel.INFO);
      
      const result = await measurePerformance(
        'Get task status from external service',
        async () => this.automationService.checkTaskStatus(taskId),
        OperationCategory.API,
        statusTraceId
      );
      
      // Add trace information to the result
      const enhancedResult = {
        ...result,
        traceId: statusTraceId,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime
      };
      
      log(`Task status retrieved from external service`, LogLevel.INFO, {
        taskStatus: enhancedResult.status,
        businessId: enhancedResult.businessId,
        hasError: !!enhancedResult.error
      });
      
      logExit(enhancedResult);
      return enhancedResult;
    } catch (error) {
      log(`Error checking task status`, LogLevel.ERROR, { error });
      
      const errorResult = {
        taskId,
        businessId: 'unknown',
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Unknown error checking task status',
        traceId: statusTraceId,
        endTime: Date.now()
      };
      
      logExit(errorResult, error);
      return errorResult;
    }
  }
  
  /**
   * Get a screenshot from a task
   * 
   * @param taskId The ID of the task 
   * @param businessId The business ID
   * @param traceId Optional trace ID for cross-component tracking
   * @param screenshotType Optional type of screenshot to retrieve
   * @returns Base64-encoded screenshot image or null if not available
   */
  public async getScreenshot(
    taskId: string, 
    businessId: string, 
    traceId?: string,
    screenshotType: string = 'final_state'
  ): Promise<string | null> {
    // Generate a trace ID if one wasn't provided
    const screenshotTraceId = traceId || generateTraceId(`screenshot-${taskId}`);
    
    // Create a function context for enhanced logging
    const { log, logEntry, logExit } = createFunctionContext(
      'getScreenshot',
      'service-bridge.ts',
      OperationCategory.TASK,
      `screenshot-${taskId}`,
      screenshotTraceId
    );
    
    // Log entry into this function
    logEntry({ 
      taskId, 
      businessId, 
      screenshotType 
    });
    
    try {
      // Check if this is a local task
      if (taskId.startsWith('local-')) {
        log(`Getting screenshot from local browser manager`, LogLevel.INFO);
        
        // For local tasks, get screenshot from browser manager
        const browserManagerModule = await measurePerformance(
          'Load browser manager for screenshot',
          loadBrowserManager,
          OperationCategory.BROWSER,
          screenshotTraceId
        );
        
        if (browserManagerModule) {
          log(`Browser manager available, retrieving screenshot`, LogLevel.INFO);
          
          const screenshot = await measurePerformance(
            'Get screenshot from browser manager',
            async () => browserManagerModule.getScreenshot(taskId, businessId, screenshotType),
            OperationCategory.TASK,
            screenshotTraceId
          );
          
          log(`Screenshot ${screenshot ? 'retrieved' : 'not available'} from browser manager`, 
            screenshot ? LogLevel.INFO : LogLevel.WARN
          );
          
          logExit({ hasScreenshot: !!screenshot });
          return screenshot;
        }
        
        log(`Browser manager not available for screenshot`, LogLevel.WARN);
        logExit({ hasScreenshot: false, reason: 'Browser manager not available' });
        return null;
      }
      
      // For external service tasks, use the automation service
      log(`Getting screenshot from external service`, LogLevel.INFO);
      
      const screenshot = await measurePerformance(
        'Get screenshot from external service',
        async () => this.automationService.getScreenshot(taskId, businessId, screenshotType),
        OperationCategory.API,
        screenshotTraceId
      );
      
      log(`Screenshot ${screenshot ? 'retrieved' : 'not available'} from external service`, 
        screenshot ? LogLevel.INFO : LogLevel.WARN
      );
      
      logExit({ hasScreenshot: !!screenshot });
      return screenshot;
    } catch (error) {
      log(`Error getting screenshot`, LogLevel.ERROR, { error });
      
      logExit(null, error);
      return null;
    }
  }
  
  /**
   * Create a post on Google Business Profile
   * 
   * @param businessId The ID of the business
   * @param postData Post content data (text, image, button)
   * @param headers Optional request headers to include
   * @param sessionId Optional session ID to associate with the request
   */
  public async createBusinessPost(
    businessId: string,
    postData: {
      text: string;
      imageUrl?: string;
      buttonText?: string;
      buttonUrl?: string;
    },
    headers?: Record<string, string>,
    sessionId?: string
  ): Promise<BrowserTaskResult> {
    try {
      logBrowserOperation(
        OperationCategory.API,
        `Creating business post for business ${businessId}`,
        LogLevel.INFO,
        { 
          businessId, 
          postLength: postData.text?.length || 0,
          hasImage: !!postData.imageUrl,
          hasButton: !!(postData.buttonText && postData.buttonUrl),
          usingSession: !!sessionId
        }
      );
      
      // Try the external service first
      try {
        if (await this.automationService.checkHealth()) {
          logBrowserOperation(
            OperationCategory.API,
            `Using external automation service for post creation`,
            LogLevel.INFO
          );
          
          // Use the existing createBusinessPost method which already has session handling
          return await this.automationService.createBusinessPost(
            businessId,
            postData,
            sessionId
          );
        }
      } catch (externalError) {
        logBrowserOperation(
          OperationCategory.API,
          `External service error during post creation`,
          LogLevel.ERROR,
          externalError
        );
      }
      
      // If external service is unavailable, try browser manager
      logBrowserOperation(
        OperationCategory.API,
        `Falling back to browser manager for post creation`,
        LogLevel.WARN
      );
      
      const browserManagerModule = await loadBrowserManager();
      if (browserManagerModule) {
        logBrowserOperation(
          OperationCategory.API,
          `Using browser manager for post creation`,
          LogLevel.INFO
        );
        
        // Generate a unique task ID
        const taskId = `local-post-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        try {
          // Get or create browser instance
          const browserInstance = await browserManagerModule.getOrCreateInstance(businessId);
          
          if (!browserInstance) {
            throw new Error('Failed to create browser instance');
          }
          
          // Create post with browser manager
          const result = await browserInstance.createPost(postData);
          
          // Convert result to standard format
          return {
            taskId,
            businessId,
            status: result.success ? 'success' : 'failed',
            result: result.success ? result : null,
            error: result.success ? null : (result.error || 'Post creation failed'),
            screenshot: result.screenshot || null
          };
        } catch (browserError) {
          logBrowserOperation(
            OperationCategory.API,
            `Browser manager post creation failed`,
            LogLevel.ERROR,
            browserError
          );
          
          return {
            taskId: `error-${Date.now()}`,
            businessId,
            status: 'failed',
            error: browserError instanceof Error ? 
              browserError.message : 
              'Unknown error during browser manager post creation'
          };
        }
      }
      
      // If we get here, both methods failed
      logBrowserOperation(
        OperationCategory.API,
        `All post creation methods failed for business ${businessId}`,
        LogLevel.ERROR
      );
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: 'No available post creation methods'
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.API,
        `Post creation error for business ${businessId}`,
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
   * Update a Google Business Profile
   * 
   * @param businessId The ID of the business
   * @param updates Profile updates to apply
   * @param headers Optional request headers to include
   * @param sessionId Optional session ID to associate with the request
   */
  public async updateBusinessProfile(
    businessId: string,
    updates: Record<string, any>,
    headers?: Record<string, string>,
    sessionId?: string
  ): Promise<BrowserTaskResult> {
    try {
      logBrowserOperation(
        OperationCategory.API,
        `Updating business profile for business ${businessId}`,
        LogLevel.INFO,
        { 
          businessId, 
          updateFields: Object.keys(updates),
          usingSession: !!sessionId
        }
      );
      
      // Try the external service first
      try {
        if (await this.automationService.checkHealth()) {
          logBrowserOperation(
            OperationCategory.API,
            `Using external automation service for profile update`,
            LogLevel.INFO
          );
          
          // Use updateBusinessProfile method from BrowserAutomationService
          // This delegates to the browser-use-api service
          return await this.automationService.updateBusinessProfile(
            businessId,
            updates.email || '',
            updates.password || '',
            updates
          );
        }
      } catch (externalError) {
        logBrowserOperation(
          OperationCategory.API,
          `External service error during profile update`,
          LogLevel.ERROR,
          externalError
        );
      }
      
      // If external service is unavailable, try browser manager
      logBrowserOperation(
        OperationCategory.API,
        `Falling back to browser manager for profile update`,
        LogLevel.WARN
      );
      
      const browserManagerModule = await loadBrowserManager();
      if (browserManagerModule) {
        logBrowserOperation(
          OperationCategory.API,
          `Using browser manager for profile update`,
          LogLevel.INFO
        );
        
        // Generate a unique task ID
        const taskId = `local-profile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        
        try {
          // Get or create browser instance
          const browserInstance = await browserManagerModule.getOrCreateInstance(businessId);
          
          if (!browserInstance) {
            throw new Error('Failed to create browser instance');
          }
          
          // Update profile with browser manager
          const result = await browserInstance.updateProfile(updates);
          
          // Convert result to standard format
          return {
            taskId,
            businessId,
            status: result.success ? 'success' : 'failed',
            result: result.success ? result : null,
            error: result.success ? null : (result.error || 'Profile update failed'),
            screenshot: result.screenshot || null
          };
        } catch (browserError) {
          logBrowserOperation(
            OperationCategory.API,
            `Browser manager profile update failed`,
            LogLevel.ERROR,
            browserError
          );
          
          return {
            taskId: `error-${Date.now()}`,
            businessId,
            status: 'failed',
            error: browserError instanceof Error ? 
              browserError.message : 
              'Unknown error during browser manager profile update'
          };
        }
      }
      
      // If we get here, both methods failed
      logBrowserOperation(
        OperationCategory.API,
        `All profile update methods failed for business ${businessId}`,
        LogLevel.ERROR
      );
      
      return {
        taskId: 'error',
        businessId,
        status: 'failed',
        error: 'No available profile update methods'
      };
    } catch (error) {
      logBrowserOperation(
        OperationCategory.API,
        `Profile update error for business ${businessId}`,
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
}