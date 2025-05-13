/**
 * Google API Logger
 * 
 * Provides centralized logging and monitoring for Google Business Profile API interactions
 * Tracks API calls, errors, tokens, and quota usage
 */

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// API operations by category
export enum ApiOperation {
  // OAuth operations
  TOKEN_FETCH = 'token_fetch',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REVOKE = 'token_revoke',
  
  // Account operations
  ACCOUNT_LIST = 'account_list',
  ACCOUNT_GET = 'account_get',
  
  // Location operations
  LOCATION_LIST = 'location_list',
  LOCATION_GET = 'location_get',
  LOCATION_UPDATE = 'location_update',
  
  // Media operations
  MEDIA_LIST = 'media_list',
  MEDIA_GET = 'media_get',
  MEDIA_UPLOAD = 'media_upload',
  MEDIA_DELETE = 'media_delete',
  
  // Post operations
  POST_LIST = 'post_list',
  POST_GET = 'post_get',
  POST_CREATE = 'post_create',
  POST_UPDATE = 'post_update',
  POST_DELETE = 'post_delete',
  
  // Review operations
  REVIEW_LIST = 'review_list',
  REVIEW_GET = 'review_get',
  REVIEW_REPLY = 'review_reply',
  REVIEW_DELETE_REPLY = 'review_delete_reply',
  
  // Fallback operations
  FALLBACK_BROWSER = 'fallback_browser',
  
  // Other
  UNKNOWN = 'unknown'
}

// API log entry type
interface ApiLogEntry {
  timestamp: string;
  operation: ApiOperation;
  level: LogLevel;
  message: string;
  userId?: string | number;
  businessId?: string | number;
  duration?: number;
  statusCode?: number;
  error?: any;
  metadata?: Record<string, any>;
  traceId?: string;
}

// Static class for API logging
export class GoogleApiLogger {
  private static logs: ApiLogEntry[] = [];
  private static maxLogSize = 1000; // Maximum number of logs to keep in memory
  private static apiCallCounts: Record<string, number> = {}; // Track API call counts for quota management
  private static isDebugMode = process.env.NODE_ENV !== 'production' || process.env.DEBUG_GOOGLE_API === 'true';
  
  /**
   * Log an API operation
   * @param operation The API operation being performed
   * @param message Log message
   * @param level Log level
   * @param metadata Additional metadata for the log
   */
  public static log(
    operation: ApiOperation, 
    message: string, 
    level: LogLevel = LogLevel.INFO,
    metadata: {
      userId?: string | number;
      businessId?: string | number;
      duration?: number;
      statusCode?: number;
      error?: any;
      traceId?: string;
      [key: string]: any;
    } = {}
  ): void {
    // Create log entry
    const logEntry: ApiLogEntry = {
      timestamp: new Date().toISOString(),
      operation,
      level,
      message,
      ...metadata
    };
    
    // Add to in-memory logs (maintain size limit)
    GoogleApiLogger.logs.unshift(logEntry);
    if (GoogleApiLogger.logs.length > GoogleApiLogger.maxLogSize) {
      GoogleApiLogger.logs = GoogleApiLogger.logs.slice(0, GoogleApiLogger.maxLogSize);
    }
    
    // Track API calls for quota monitoring
    GoogleApiLogger.trackApiCall(operation, logEntry.timestamp);
    
    // Output to console in development or if debug mode is enabled
    if (GoogleApiLogger.isDebugMode || level === LogLevel.ERROR) {
      const consoleMethod = GoogleApiLogger.getConsoleMethod(level);
      
      // Format the log message for the console
      const logPrefix = `[GoogleAPI:${operation}]`;
      const userInfo = logEntry.userId ? `[User:${logEntry.userId}]` : '';
      const businessInfo = logEntry.businessId ? `[Business:${logEntry.businessId}]` : '';
      const traceInfo = logEntry.traceId ? `[Trace:${logEntry.traceId}]` : '';
      const statusInfo = logEntry.statusCode ? `[Status:${logEntry.statusCode}]` : '';
      const durationInfo = logEntry.duration ? `[${logEntry.duration}ms]` : '';
      
      const formattedMessage = `${logPrefix}${userInfo}${businessInfo}${traceInfo}${statusInfo}${durationInfo} ${message}`;
      
      // Log to console
      if (logEntry.error) {
        consoleMethod(formattedMessage, logEntry.error);
      } else {
        consoleMethod(formattedMessage);
      }
      
      // Additional detailed logging for dev mode
      if (GoogleApiLogger.isDebugMode && logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
        console.debug('Metadata:', logEntry.metadata);
      }
    }
    
    // In production, we would typically send this to a logging service
    if (process.env.NODE_ENV === 'production') {
      GoogleApiLogger.sendToExternalLoggingService(logEntry);
    }
  }
  
  /**
   * Log an API error
   * @param operation The API operation that failed
   * @param error The error that occurred
   * @param metadata Additional metadata for the log
   */
  public static logError(
    operation: ApiOperation,
    error: any,
    metadata: {
      userId?: string | number;
      businessId?: string | number;
      duration?: number;
      statusCode?: number;
      traceId?: string;
      [key: string]: any;
    } = {}
  ): void {
    // Extract error message
    let errorMessage = 'Unknown error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      try {
        errorMessage = JSON.stringify(error);
      } catch (e) {
        errorMessage = 'Complex error object';
      }
    }
    
    // Log the error
    GoogleApiLogger.log(
      operation,
      `Error: ${errorMessage}`,
      LogLevel.ERROR,
      {
        ...metadata,
        error
      }
    );
  }
  
  /**
   * Get recent logs
   * @param limit Maximum number of logs to return
   * @param level Optional filter by log level
   * @param operation Optional filter by operation
   * @returns Filtered logs
   */
  public static getLogs(
    limit: number = 100,
    level?: LogLevel,
    operation?: ApiOperation
  ): ApiLogEntry[] {
    // Apply filters if provided
    let filteredLogs = GoogleApiLogger.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    if (operation) {
      filteredLogs = filteredLogs.filter(log => log.operation === operation);
    }
    
    // Return the limited logs
    return filteredLogs.slice(0, limit);
  }
  
  /**
   * Get API call counts and quota usage
   * @returns API call statistics
   */
  public static getApiCallStats(): {
    totalCalls: number;
    callsByOperation: Record<string, number>;
    dailyCalls: number;
    estimatedQuotaUsage: number;
  } {
    // Get current date
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Count total calls
    const totalCalls = Object.values(GoogleApiLogger.apiCallCounts).reduce((sum, count) => sum + count, 0);
    
    // Count calls for today
    const dailyCalls = GoogleApiLogger.logs
      .filter(log => log.timestamp.startsWith(currentDate))
      .length;
    
    // For a real implementation, you would need to know the actual quota limits
    // This is a placeholder calculation
    const dailyQuota = 10000; // Placeholder
    const estimatedQuotaUsage = (dailyCalls / dailyQuota) * 100;
    
    return {
      totalCalls,
      callsByOperation: { ...GoogleApiLogger.apiCallCounts },
      dailyCalls,
      estimatedQuotaUsage
    };
  }
  
  /**
   * Reset logs and counters
   * Useful for tests and during development
   */
  public static reset(): void {
    GoogleApiLogger.logs = [];
    GoogleApiLogger.apiCallCounts = {};
  }
  
  /**
   * Track API call for quota monitoring
   * @param operation API operation
   * @param timestamp ISO timestamp
   */
  private static trackApiCall(operation: ApiOperation, timestamp: string): void {
    // Initialize counter if needed
    if (!GoogleApiLogger.apiCallCounts[operation]) {
      GoogleApiLogger.apiCallCounts[operation] = 0;
    }
    
    // Increment counter
    GoogleApiLogger.apiCallCounts[operation]++;
  }
  
  /**
   * Get the appropriate console method for the log level
   * @param level Log level
   * @returns Console method
   */
  private static getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.log;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }
  
  /**
   * Send log to an external logging service
   * @param logEntry Log entry to send
   */
  private static sendToExternalLoggingService(logEntry: ApiLogEntry): void {
    // This would typically send the log to a service like Datadog, New Relic, etc.
    // For now, we'll just log that we would send it
    if (GoogleApiLogger.isDebugMode) {
      console.debug('[GoogleApiLogger] Would send to external logging service:', logEntry);
    }
    
    // Example implementation with fetch:
    /*
    try {
      fetch('/api/logging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'google-api',
          level: logEntry.level,
          message: logEntry.message,
          metadata: {
            operation: logEntry.operation,
            userId: logEntry.userId,
            businessId: logEntry.businessId,
            timestamp: logEntry.timestamp,
            ...logEntry.metadata
          }
        })
      }).catch(err => {
        console.error('Failed to send log to external service:', err);
      });
    } catch (err) {
      console.error('Error sending log to external service:', err);
    }
    */
  }
}