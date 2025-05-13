/**
 * Browser Automation Logging Utilities
 * 
 * Provides structured logging for browser automation operations
 * with control over verbosity, sensitive data handling, and tracing.
 * 
 * Features:
 * - Consistent log formatting across all browser automation components
 * - Trace ID generation and propagation for end-to-end request tracking
 * - Sensitive data sanitization
 * - Performance monitoring
 * - Environment-aware logging levels
 */

// Export all functions as named exports and not as default export

import { BrowserAutomationConfig } from '../browser-automation/config';

/**
 * Log levels for browser automation operations
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  TRACE = 'trace'  // Most detailed level
}

/**
 * Logged operation categories for browser automation
 */
export enum OperationCategory {
  AUTH = 'auth',
  API = 'api',
  BROWSER = 'browser',
  SESSION = 'session',
  CONFIG = 'config',
  TASK = 'task',
  BUSINESS_POST = 'business-post',
  BUSINESS_PROFILE = 'business-profile',
  NETWORK = 'network',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  STORAGE = 'storage',
  ENTRY = 'entry',  // For entry points into files/functions
  EXIT = 'exit'     // For exit points from files/functions
}

/**
 * Visual indicators for log types to make them more scannable
 */
const LOG_ICONS = {
  [LogLevel.DEBUG]: '🔍',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.WARN]: '⚠️',
  [LogLevel.ERROR]: '❌',
  [LogLevel.TRACE]: '🔬',
  [OperationCategory.AUTH]: '🔐',
  [OperationCategory.API]: '🌐',
  [OperationCategory.BROWSER]: '🖥️',
  [OperationCategory.SESSION]: '🔑',
  [OperationCategory.CONFIG]: '⚙️',
  [OperationCategory.TASK]: '📋',
  [OperationCategory.BUSINESS_POST]: '📝',
  [OperationCategory.BUSINESS_PROFILE]: '👤',
  [OperationCategory.NETWORK]: '📡',
  [OperationCategory.SECURITY]: '🛡️',
  [OperationCategory.PERFORMANCE]: '⏱️',
  [OperationCategory.STORAGE]: '💾',
  [OperationCategory.ENTRY]: '▶️',
  [OperationCategory.EXIT]: '◀️'
};

// Storage for active trace IDs
const activeTraceIds = new Map<string, string>();

/**
 * Generate a unique trace ID for tracking requests through the system
 */
export function generateTraceId(prefix: string = 'trace'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Set an active trace ID for the current context
 */
export function setTraceId(contextKey: string, traceId: string): void {
  activeTraceIds.set(contextKey, traceId);
}

/**
 * Get the active trace ID for the current context
 */
export function getTraceId(contextKey: string): string | undefined {
  return activeTraceIds.get(contextKey);
}

/**
 * Clear a trace ID when a context is completed
 */
export function clearTraceId(contextKey: string): void {
  activeTraceIds.delete(contextKey);
}

/**
 * Create a function context with automatic entry/exit logging
 * 
 * @param functionName Name of the function being traced
 * @param filePath Path of the file containing the function
 * @param category Operation category
 * @param contextKey Optional key to store trace ID under
 * @param existingTraceId Optional existing trace ID to use
 * @returns Object with trace ID and logging functions
 */
export function createFunctionContext(
  functionName: string,
  filePath: string,
  category: OperationCategory,
  contextKey?: string,
  existingTraceId?: string
): {
  traceId: string;
  log: (message: string, level?: LogLevel, data?: any) => void;
  logEntry: (data?: any) => void;
  logExit: (result?: any, error?: any) => void;
} {
  const traceId = existingTraceId || generateTraceId(functionName);
  const key = contextKey || `${filePath}:${functionName}`;
  
  // Store trace ID in active traces
  setTraceId(key, traceId);
  
  // Create specialized log function for this context
  const log = (message: string, level: LogLevel = LogLevel.INFO, data?: any) => {
    logBrowserOperation(category, message, level, data, traceId);
  };
  
  // Function entry log
  const logEntry = (data?: any) => {
    log(`ENTERING function ${functionName} in ${filePath}`, LogLevel.TRACE, data);
  };
  
  // Function exit log
  const logExit = (result?: any, error?: any) => {
    if (error) {
      log(`EXITING function ${functionName} with ERROR`, LogLevel.ERROR, { error, ...(result && { result }) });
    } else {
      log(`EXITING function ${functionName}`, LogLevel.TRACE, result);
    }
    
    // Clean up trace ID when function exits
    clearTraceId(key);
  };
  
  return { traceId, log, logEntry, logExit };
}

/**
 * Log a browser automation operation with appropriate suppression
 * based on environment settings, with optional trace ID
 */
export function logBrowserOperation(
  category: OperationCategory,
  message: string,
  level: LogLevel = LogLevel.INFO,
  data?: any,
  traceId?: string
): void {
  // Enhanced condition to support forced logging through environment variable
  const shouldLog = 
    BrowserAutomationConfig.logging.verbose || 
    level === LogLevel.ERROR || 
    level === LogLevel.WARN ||
    process.env.FORCE_BROWSER_LOGS === 'true' ||
    process.env.LOG_LEVEL === 'debug' ||
    process.env.DEBUG_BROWSER === 'true';
    
  if (!shouldLog) {
    return;
  }
  
  // Add environment trace information 
  const traceInfo = {
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV || 'not set',
    timestamp: new Date().toISOString(),
    traceId: traceId || 'no-trace-id'
  };
  
  // Merge trace info with data if provided
  const enhancedData = data ? { ...data, _trace: traceInfo } : traceInfo;
  
  // Create formatted timestamp
  const timestamp = new Date().toISOString().split('T')[1].substring(0, 12);
  
  // Get icons for level and category
  const levelIcon = LOG_ICONS[level] || '';
  const categoryIcon = LOG_ICONS[category] || '';
  
  // Create prefix for log with trace ID if available
  const tracePrefix = traceId ? `[${traceId}]` : '';
  const prefix = `[BROWSER-${category.toUpperCase()}:${timestamp}]${tracePrefix}`;
  
  // Choose appropriate log method
  let logMethod: (message: string, ...data: any[]) => void;
  switch (level) {
    case LogLevel.DEBUG:
    case LogLevel.TRACE:
      logMethod = console.debug;
      break;
    case LogLevel.INFO:
      logMethod = console.log;
      break;
    case LogLevel.WARN:
      logMethod = console.warn;
      break;
    case LogLevel.ERROR:
      logMethod = console.error;
      break;
    default:
      logMethod = console.log;
  }
  
  // Log the message with enhanced prefix and timing
  const startTime = Date.now();
  
  // Enhanced prefix with more diagnostic information and icons
  const enhancedPrefix = `${prefix} ${levelIcon}${categoryIcon} [${process.pid}:${level}] [${category}]`;
  
  if (enhancedData !== undefined) {
    // Sanitize data if necessary
    const sanitizedData = sanitizeData(enhancedData);
    logMethod(`${enhancedPrefix} ${message}`, sanitizedData);
  } else {
    logMethod(`${enhancedPrefix} ${message}`);
  }
  
  // Log timing for performance monitoring on DEBUG level
  const timeTaken = Date.now() - startTime;
  if (timeTaken > 5) { // Only log if logging itself took more than 5ms
    console.debug(`${prefix} ${LOG_ICONS[OperationCategory.PERFORMANCE]} [PERF] Logging took ${timeTaken}ms`);
  }
}

/**
 * Log entry into a file with clear demarcation
 * 
 * @param filePath The path of the file being entered
 * @param traceId Optional trace ID for tracking
 * @returns The trace ID used
 */
export function logFileEntry(filePath: string, traceId?: string): string {
  const generatedTraceId = traceId || generateTraceId(`file-${filePath.split('/').pop()}`);
  
  logBrowserOperation(
    OperationCategory.ENTRY,
    `====== ENTERING FILE: ${filePath} ======`,
    LogLevel.INFO,
    {
      timestamp: new Date().toISOString(),
      file: filePath
    },
    generatedTraceId
  );
  
  return generatedTraceId;
}

/**
 * Log exit from a file with clear demarcation
 * 
 * @param filePath The path of the file being exited
 * @param traceId The trace ID used for entry
 * @param result Optional result data
 */
export function logFileExit(filePath: string, traceId: string, result?: any): void {
  logBrowserOperation(
    OperationCategory.EXIT,
    `====== EXITING FILE: ${filePath} ======`,
    LogLevel.INFO,
    {
      timestamp: new Date().toISOString(),
      file: filePath,
      ...(result && { result: sanitizeData(result) })
    },
    traceId
  );
}

/**
 * Measure and log the performance of a function
 * 
 * @param operationName Name of the operation being measured
 * @param fn Function to measure
 * @param category Operation category
 * @param traceId Optional trace ID
 * @returns The result of the function
 */
export async function measurePerformance<T>(
  operationName: string,
  fn: () => Promise<T>,
  category: OperationCategory = OperationCategory.PERFORMANCE,
  traceId?: string
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    logBrowserOperation(
      category,
      `Operation '${operationName}' completed in ${duration}ms`,
      duration > 1000 ? LogLevel.WARN : LogLevel.INFO,
      { duration, operationName },
      traceId
    );
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logBrowserOperation(
      category,
      `Operation '${operationName}' failed after ${duration}ms`,
      LogLevel.ERROR,
      { duration, operationName, error },
      traceId
    );
    
    throw error;
  }
}

/**
 * Sanitize potentially sensitive data before logging
 */
function sanitizeData(data: any): any {
  // If logging sensitive data is allowed, return as is
  if (BrowserAutomationConfig.logging.logSensitive) {
    return data;
  }
  
  // Return early for null or undefined
  if (data === null || data === undefined) {
    return data;
  }
  
  // Make a deep copy of the data
  let sanitized: any;
  
  try {
    sanitized = JSON.parse(JSON.stringify(data));
  } catch (e) {
    // If JSON conversion fails, try a shallow copy
    if (Array.isArray(data)) {
      sanitized = [...data];
    } else if (typeof data === 'object') {
      sanitized = { ...data };
    } else {
      // For primitive values, just return as is
      return data;
    }
  }
  
  // List of properties that might contain sensitive info
  const sensitiveProps = [
    'password', 'credential', 'token', 'secret', 'key', 'auth',
    'encryptedPassword', 'passwordHash', 'apiKey', 'api_key',
    'jwt', 'cookie', 'session', 'private', 'apiSecret', 'api_secret'
  ];
  
  // Function to recursively sanitize an object
  const sanitizeObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      // Check if this is a sensitive property
      const isSensitive = sensitiveProps.some(prop => 
        key.toLowerCase().includes(prop.toLowerCase())
      );
      
      if (isSensitive && typeof obj[key] === 'string') {
        // Mask the sensitive value
        obj[key] = '********';
      } else if (obj[key] && typeof obj[key] === 'object') {
        // Recursively sanitize nested objects
        sanitizeObject(obj[key]);
      }
    });
  };
  
  // Apply sanitization
  sanitizeObject(sanitized);
  
  return sanitized;
}

/**
 * Get a timestamp-based filename for a screenshot
 * @param userId The user ID
 * @param description A brief description of the screenshot
 * @param extension The file extension (default: png)
 * @returns A formatted string with the screenshot path
 */
export function getScreenshotFilename(
  userId: string | number, 
  description: string,
  extension: string = 'png'
): string {
  const timestamp = Date.now();
  // Sanitize description to be safe for filenames
  const safeDescription = description.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  
  return `${userId}/${timestamp}-${safeDescription}.${extension}`;
}

/**
 * Creates a directory structure for a user's screenshots
 * @param userId The user ID
 * @returns The path to the user's screenshot directory
 */
export function ensureUserScreenshotDirectory(userId: string | number): string {
  const baseDir = '/home/ubuntu/Social-Genius/src/api/browser-use/screenshots';
  const userDir = `${baseDir}/${userId}`;
  
  // In a browser environment, return the path only - we can't create directories
  if (typeof window !== 'undefined') {
    return userDir;
  }
  
  // In Node.js environment, create the directory if it doesn't exist
  try {
    const fs = require('fs');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    return userDir;
  } catch (error) {
    console.error(`Error creating screenshot directory for user ${userId}:`, error);
    return userDir; // Return the path anyway
  }
}

/**
 * Capture a page screenshot with error handling and validation
 * @param page The Playwright page object
 * @param userId User ID to organize screenshots
 * @param description Brief description of the screenshot
 * @param options Additional options
 * @returns Path to the screenshot or null if failed
 */
export async function capturePageScreenshot(
  page: any,
  userId: string | number,
  description: string,
  options?: {
    fullPage?: boolean;
    path?: string;
    returnBase64?: boolean;
    traceId?: string;
  }
): Promise<string | null> {
  try {
    const screenshotDir = ensureUserScreenshotDirectory(userId);
    const timestamp = Date.now();
    const safeDescription = description.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const filename = `${timestamp}-${safeDescription}.png`;
    const path = options?.path || `${screenshotDir}/${filename}`;
    
    // Create a UUID for this screenshot
    const screenshotId = `${userId}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Log with trace information if provided
    const logPrefix = options?.traceId ? `[Screenshot:${options.traceId}]` : '[Screenshot]';
    console.log(`${logPrefix} Capturing screenshot "${description}" for user ${userId}`);
    
    // Capture the screenshot
    const buffer = await page.screenshot({ 
      path: path,
      fullPage: options?.fullPage !== false,
      // Add a small delay to ensure the page is rendered
      timeout: 5000
    });
    
    // Verify the file was created and is a valid image
    const fs = require('fs');
    if (fs.existsSync(path)) {
      const fileStats = fs.statSync(path);
      if (fileStats.size > 0) {
        // Check the first bytes to confirm it's a PNG file
        const fileBuffer = fs.readFileSync(path, { start: 0, end: 8 });
        const isPNG = fileBuffer.length > 8 && 
                    fileBuffer[0] === 0x89 && 
                    fileBuffer[1] === 0x50 && 
                    fileBuffer[2] === 0x4E && 
                    fileBuffer[3] === 0x47;
        
        if (isPNG) {
          console.log(`${logPrefix} ✅ Successfully captured screenshot: ${path} (${fileStats.size} bytes)`);
        } else {
          console.error(`${logPrefix} ❌ File is not a valid PNG image: ${path}`);
          // Try to rename the file to indicate it's not a valid PNG
          try {
            const newPath = `${path}.invalid`;
            fs.renameSync(path, newPath);
            console.log(`${logPrefix} Renamed invalid PNG to ${newPath}`);
          } catch (renameErr) {
            console.error(`${logPrefix} Failed to rename invalid PNG:`, renameErr);
          }
        }
      } else {
        console.error(`${logPrefix} ❌ Screenshot file is empty: ${path}`);
      }
    } else {
      console.error(`${logPrefix} ❌ Failed to create screenshot file: ${path}`);
    }
    
    // Return as base64 if requested
    if (options?.returnBase64 && buffer) {
      return `data:image/png;base64,${buffer.toString('base64')}`;
    }
    
    return path;
  } catch (error) {
    const logPrefix = options?.traceId ? `[Screenshot:${options.traceId}]` : '[Screenshot]';
    console.error(`${logPrefix} ❌ Failed to capture screenshot (${description}):`, error);
    return null;
  }
}