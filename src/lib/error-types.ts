/**
 * Error Types for Browser Automation
 * 
 * Defines standardized error types and error handling utilities for browser automation
 * to provide consistent error reporting across the application.
 */

// Error categories
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  NETWORK = 'network',
  BROWSER = 'browser',
  SESSION = 'session',
  API = 'api',
  AUTOMATION = 'automation',
  SECURITY = 'security',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  FATAL = 'fatal',    // Application cannot continue
  ERROR = 'error',    // Operation failed, but application can continue
  WARNING = 'warning', // Operation succeeded with warnings
  INFO = 'info'       // Informational message
}

// Error codes for specific error types
export const ErrorCodes = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'auth_invalid_credentials',
  AUTH_ACCOUNT_LOCKED: 'auth_account_locked',
  AUTH_CAPTCHA_REQUIRED: 'auth_captcha_required',
  AUTH_TWO_FACTOR_REQUIRED: 'auth_two_factor_required',
  AUTH_SESSION_EXPIRED: 'auth_session_expired',
  AUTH_VERIFICATION_REQUIRED: 'auth_verification_required',
  
  // Network errors
  NETWORK_CONNECTION_FAILED: 'network_connection_failed',
  NETWORK_TIMEOUT: 'network_timeout',
  NETWORK_RATE_LIMITED: 'network_rate_limited',
  
  // Browser errors
  BROWSER_LAUNCH_FAILED: 'browser_launch_failed',
  BROWSER_CRASHED: 'browser_crashed',
  BROWSER_RESOURCE_ERROR: 'browser_resource_error',
  
  // Session errors
  SESSION_NOT_FOUND: 'session_not_found',
  SESSION_CORRUPTED: 'session_corrupted',
  SESSION_STORAGE_ERROR: 'session_storage_error',
  
  // API errors
  API_REQUEST_FAILED: 'api_request_failed',
  API_RESPONSE_ERROR: 'api_response_error',
  API_SERVICE_UNAVAILABLE: 'api_service_unavailable',
  
  // Automation errors
  AUTOMATION_SELECTOR_NOT_FOUND: 'automation_selector_not_found',
  AUTOMATION_ACTION_FAILED: 'automation_action_failed',
  AUTOMATION_NAVIGATION_FAILED: 'automation_navigation_failed',
  AUTOMATION_TIMEOUT: 'automation_timeout',
  
  // Security errors
  SECURITY_CRYPTO_ERROR: 'security_crypto_error',
  SECURITY_UNAUTHORIZED: 'security_unauthorized',
  SECURITY_TOKEN_INVALID: 'security_token_invalid',
  
  // Unknown errors
  UNKNOWN_ERROR: 'unknown_error'
};

// Error details type
export interface ErrorDetails {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: Date;
  traceId?: string;
  businessId?: string;
  context?: Record<string, any>;
  originalError?: Error;
  recoverySuggestion?: string;
  retryable: boolean;
}

/**
 * Browser Automation Error class
 */
export class BrowserAutomationError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly traceId?: string;
  public readonly businessId?: string;
  public readonly context?: Record<string, any>;
  public readonly originalError?: Error;
  public readonly recoverySuggestion?: string;
  public readonly retryable: boolean;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.name = 'BrowserAutomationError';
    this.code = details.code;
    this.category = details.category;
    this.severity = details.severity;
    this.timestamp = details.timestamp;
    this.traceId = details.traceId;
    this.businessId = details.businessId;
    this.context = details.context;
    this.originalError = details.originalError;
    this.recoverySuggestion = details.recoverySuggestion;
    this.retryable = details.retryable;
    
    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BrowserAutomationError);
    }
  }

  /**
   * Convert error to a standardized object for logging or API responses
   */
  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      traceId: this.traceId,
      businessId: this.businessId,
      recoverySuggestion: this.recoverySuggestion,
      retryable: this.retryable,
      stack: this.stack?.split('\n').map(line => line.trim()),
      context: this.context
    };
  }

  /**
   * Convert error to a user-friendly message
   */
  public toUserMessage(): string {
    // Start with a generic message based on the category
    let baseMessage = 'An error occurred';
    
    switch (this.category) {
      case ErrorCategory.AUTHENTICATION:
        baseMessage = 'Authentication failed';
        break;
      case ErrorCategory.NETWORK:
        baseMessage = 'Network connection issue';
        break;
      case ErrorCategory.BROWSER:
        baseMessage = 'Browser error';
        break;
      case ErrorCategory.SESSION:
        baseMessage = 'Session error';
        break;
      case ErrorCategory.API:
        baseMessage = 'API service error';
        break;
      case ErrorCategory.AUTOMATION:
        baseMessage = 'Automation error';
        break;
      case ErrorCategory.SECURITY:
        baseMessage = 'Security error';
        break;
    }

    // Add specific error message
    let fullMessage = `${baseMessage}: ${this.message}`;
    
    // Add recovery suggestion if available
    if (this.recoverySuggestion) {
      fullMessage += `. ${this.recoverySuggestion}`;
    }
    
    // Add if retryable
    if (this.retryable) {
      fullMessage += '. You can try again.';
    }
    
    return fullMessage;
  }
}

/**
 * Create a new browser automation error
 */
export function createError(
  code: string,
  message: string,
  options: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    traceId?: string;
    businessId?: string;
    context?: Record<string, any>;
    originalError?: Error;
    recoverySuggestion?: string;
    retryable?: boolean;
  } = {}
): BrowserAutomationError {
  // Determine category based on code if not provided
  let category = options.category;
  if (!category) {
    if (code.startsWith('auth_')) category = ErrorCategory.AUTHENTICATION;
    else if (code.startsWith('network_')) category = ErrorCategory.NETWORK;
    else if (code.startsWith('browser_')) category = ErrorCategory.BROWSER;
    else if (code.startsWith('session_')) category = ErrorCategory.SESSION;
    else if (code.startsWith('api_')) category = ErrorCategory.API;
    else if (code.startsWith('automation_')) category = ErrorCategory.AUTOMATION;
    else if (code.startsWith('security_')) category = ErrorCategory.SECURITY;
    else category = ErrorCategory.UNKNOWN;
  }
  
  // Set default severity based on category
  let severity = options.severity;
  if (!severity) {
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.SECURITY:
        severity = ErrorSeverity.ERROR;
        break;
      case ErrorCategory.BROWSER:
      case ErrorCategory.API:
        severity = ErrorSeverity.ERROR;
        break;
      case ErrorCategory.NETWORK:
        severity = ErrorSeverity.ERROR;
        break;
      case ErrorCategory.AUTOMATION:
        severity = ErrorSeverity.ERROR;
        break;
      case ErrorCategory.SESSION:
        severity = ErrorSeverity.WARNING;
        break;
      default:
        severity = ErrorSeverity.ERROR;
    }
  }
  
  // Create recovery suggestions based on error code
  let recoverySuggestion = options.recoverySuggestion;
  if (!recoverySuggestion) {
    switch (code) {
      case ErrorCodes.AUTH_INVALID_CREDENTIALS:
        recoverySuggestion = 'Please check your email and password and try again';
        break;
      case ErrorCodes.AUTH_ACCOUNT_LOCKED:
        recoverySuggestion = 'Your account has been locked. Please visit Google account recovery to reset your password';
        break;
      case ErrorCodes.AUTH_CAPTCHA_REQUIRED:
        recoverySuggestion = 'Google is requesting additional verification. Please log in to your Google account directly and complete the verification';
        break;
      case ErrorCodes.AUTH_TWO_FACTOR_REQUIRED:
        recoverySuggestion = '2FA is enabled on your account. Please use an app password instead or use OAuth login';
        break;
      case ErrorCodes.NETWORK_CONNECTION_FAILED:
        recoverySuggestion = 'Please check your internet connection';
        break;
      case ErrorCodes.NETWORK_TIMEOUT:
        recoverySuggestion = 'The operation timed out. Please try again when you have a stable connection';
        break;
      case ErrorCodes.NETWORK_RATE_LIMITED:
        recoverySuggestion = 'Too many requests. Please wait a few minutes before trying again';
        break;
      case ErrorCodes.SESSION_EXPIRED:
        recoverySuggestion = 'Your session has expired. Please log in again';
        break;
    }
  }
  
  // Determine if error is retryable based on code
  let retryable = options.retryable;
  if (retryable === undefined) {
    switch (code) {
      case ErrorCodes.AUTH_INVALID_CREDENTIALS:
      case ErrorCodes.NETWORK_CONNECTION_FAILED:
      case ErrorCodes.NETWORK_TIMEOUT:
      case ErrorCodes.API_REQUEST_FAILED:
      case ErrorCodes.AUTOMATION_TIMEOUT:
        retryable = true;
        break;
      case ErrorCodes.AUTH_ACCOUNT_LOCKED:
      case ErrorCodes.AUTH_CAPTCHA_REQUIRED:
      case ErrorCodes.AUTH_TWO_FACTOR_REQUIRED:
      case ErrorCodes.BROWSER_LAUNCH_FAILED:
      case ErrorCodes.SESSION_CORRUPTED:
        retryable = false;
        break;
      default:
        retryable = false;
    }
  }
  
  return new BrowserAutomationError({
    code,
    message,
    category,
    severity,
    timestamp: new Date(),
    traceId: options.traceId,
    businessId: options.businessId,
    context: options.context,
    originalError: options.originalError,
    recoverySuggestion,
    retryable
  });
}

/**
 * Map an external/generic error to a browser automation error
 */
export function mapError(
  error: unknown,
  options: {
    defaultCode?: string;
    defaultMessage?: string;
    traceId?: string;
    businessId?: string;
    context?: Record<string, any>;
  } = {}
): BrowserAutomationError {
  // Default code and message
  const defaultCode = options.defaultCode || ErrorCodes.UNKNOWN_ERROR;
  const defaultMessage = options.defaultMessage || 'An unexpected error occurred';
  
  // Handle null or undefined
  if (error === null || error === undefined) {
    return createError(defaultCode, defaultMessage, options);
  }
  
  // Handle BrowserAutomationError directly
  if (error instanceof BrowserAutomationError) {
    // Update with new context if provided
    if (options.context || options.traceId || options.businessId) {
      return new BrowserAutomationError({
        ...error,
        traceId: options.traceId || error.traceId,
        businessId: options.businessId || error.businessId,
        context: options.context ? { ...error.context, ...options.context } : error.context
      });
    }
    return error;
  }
  
  // Handle standard Error
  if (error instanceof Error) {
    // Try to extract information from the error message to determine the appropriate error code
    const message = error.message.toLowerCase();
    
    // Handle authentication errors
    if (message.includes('invalid credentials') || message.includes('incorrect password')) {
      return createError(ErrorCodes.AUTH_INVALID_CREDENTIALS, error.message, {
        ...options,
        originalError: error
      });
    }
    
    if (message.includes('account locked') || message.includes('too many attempts')) {
      return createError(ErrorCodes.AUTH_ACCOUNT_LOCKED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    if (message.includes('captcha') || message.includes('verification')) {
      return createError(ErrorCodes.AUTH_CAPTCHA_REQUIRED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    if (message.includes('two factor') || message.includes('2fa') || message.includes('two-factor')) {
      return createError(ErrorCodes.AUTH_TWO_FACTOR_REQUIRED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    // Handle network errors
    if (message.includes('network') || message.includes('connection')) {
      return createError(ErrorCodes.NETWORK_CONNECTION_FAILED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return createError(ErrorCodes.NETWORK_TIMEOUT, error.message, {
        ...options,
        originalError: error
      });
    }
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return createError(ErrorCodes.NETWORK_RATE_LIMITED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    // Handle browser errors
    if (message.includes('browser') && (message.includes('launch') || message.includes('start'))) {
      return createError(ErrorCodes.BROWSER_LAUNCH_FAILED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    if (message.includes('crash') || message.includes('terminated')) {
      return createError(ErrorCodes.BROWSER_CRASHED, error.message, {
        ...options,
        originalError: error
      });
    }
    
    // If no specific condition matched, use the default error
    return createError(defaultCode, error.message, {
      ...options,
      originalError: error
    });
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return createError(defaultCode, error, options);
  }
  
  // Handle other types
  return createError(
    defaultCode,
    typeof error === 'object' ? JSON.stringify(error) : String(error),
    options
  );
}

/**
 * Error retry utilities
 */
export const ErrorRetry = {
  /**
   * Calculate delay for exponential backoff
   */
  calculateBackoff(attempt: number, options: {
    baseDelay?: number;
    maxDelay?: number;
    jitter?: boolean;
  } = {}): number {
    const baseDelay = options.baseDelay || 1000; // 1 second
    const maxDelay = options.maxDelay || 30000;  // 30 seconds
    const jitter = options.jitter !== false;     // Default to true
    
    // Calculate exponential backoff: baseDelay * 2^attempt
    let delay = baseDelay * Math.pow(2, attempt);
    
    // Apply jitter if enabled: randomize between 50-100% of the delay
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    // Cap at max delay
    return Math.min(delay, maxDelay);
  },
  
  /**
   * Check if an error should be retried based on retry conditions
   */
  shouldRetry(error: BrowserAutomationError, attempt: number, maxAttempts: number): boolean {
    // Don't retry if explicitly marked as non-retryable
    if (!error.retryable) {
      return false;
    }
    
    // Don't retry if we've exceeded max attempts
    if (attempt >= maxAttempts) {
      return false;
    }
    
    // Special rules for specific error categories
    switch (error.category) {
      case ErrorCategory.NETWORK:
        // Always retry network errors (up to max attempts)
        return true;
      
      case ErrorCategory.AUTHENTICATION:
        // Only retry certain authentication errors
        return [
          ErrorCodes.AUTH_INVALID_CREDENTIALS,
          ErrorCodes.SESSION_EXPIRED
        ].includes(error.code);
      
      case ErrorCategory.BROWSER:
        // Retry browser crashes and resource errors, but not launch failures
        return error.code !== ErrorCodes.BROWSER_LAUNCH_FAILED;
      
      case ErrorCategory.AUTOMATION:
        // Retry timeouts and navigation failures
        return [
          ErrorCodes.AUTOMATION_TIMEOUT,
          ErrorCodes.AUTOMATION_NAVIGATION_FAILED
        ].includes(error.code);
      
      default:
        // Use the default retryable flag
        return error.retryable;
    }
  },
  
  /**
   * Execute a function with automatic retries
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      jitter?: boolean;
      retryIf?: (error: BrowserAutomationError, attempt: number) => boolean;
      onRetry?: (error: BrowserAutomationError, attempt: number, delay: number) => void;
    } = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts || 3;
    const retryIf = options.retryIf || ((error, attempt) => ErrorRetry.shouldRetry(error, attempt, maxAttempts));
    const onRetry = options.onRetry || (() => {});
    
    let attempt = 0;
    
    while (true) {
      try {
        return await fn();
      } catch (error) {
        // Map to BrowserAutomationError if it's not already
        const browserError = error instanceof BrowserAutomationError 
          ? error 
          : mapError(error);
        
        attempt++;
        
        // Check if we should retry
        if (attempt < maxAttempts && retryIf(browserError, attempt)) {
          // Calculate backoff delay
          const delay = ErrorRetry.calculateBackoff(attempt, {
            baseDelay: options.baseDelay,
            maxDelay: options.maxDelay,
            jitter: options.jitter
          });
          
          // Notify retry callback
          onRetry(browserError, attempt, delay);
          
          // Wait for backoff delay
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Continue to next attempt
          continue;
        }
        
        // If we shouldn't retry, rethrow the error
        throw browserError;
      }
    }
  }
};