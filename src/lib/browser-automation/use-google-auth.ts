import { useState, useEffect, useCallback } from 'react';
import { BrowserAutomationService, BrowserTaskResult } from '../../../lib/browser-automation';
import { encryptPassword } from '../../../lib/utilities/password-encryption';

interface UseGoogleAuthProps {
  businessId: string;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string, errorCode?: string) => void;
  enableLogging?: boolean;
}

interface UseGoogleAuthReturn {
  showAuthForm: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  authProgress: number;
  taskId: string | null;
  screenshot: string | null;
  errorCode: string | null;
  sessionData: any | null;
  startAuth: () => void;
  cancelAuth: () => void;
  completeAuth: (email: string, password: string) => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
}

// Results returned from Google authentication process
export interface GoogleAuthResult {
  success: boolean;
  businessId?: string;
  taskId?: string;
  error?: string;
  errorCode?: string;
  screenshot?: string;
  sessionData?: any;
  message?: string;
}

/**
 * Custom hook to manage Google authentication flow with enhanced logging and error handling
 */
export function useGoogleAuth({ 
  businessId, 
  onSuccess, 
  onError,
  enableLogging = true 
}: UseGoogleAuthProps): UseGoogleAuthReturn {
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [authProgress, setAuthProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Logger function with timestamp
  const log = useCallback((message: string, level: 'info' | 'error' | 'warn' = 'info') => {
    if (!enableLogging && level !== 'error') return;
    
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    const prefix = `[GOOGLE-AUTH ${timestamp}] [Business ${businessId}]`;
    
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }, [businessId, enableLogging]);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        log('Cleaned up status check interval on unmount');
      }
    };
  }, [statusCheckInterval, log]);
  
  // Start authentication flow
  const startAuth = useCallback(() => {
    log('Starting Google authentication flow');
    setShowAuthForm(true);
    setAuthError(null);
    setErrorCode(null);
    setScreenshot(null);
    setSessionData(null);
    setAuthProgress(0);
  }, [log]);
  
  // Cancel authentication
  const cancelAuth = useCallback(() => {
    log('Cancelling Google authentication flow');
    setShowAuthForm(false);
    setIsAuthenticating(false);
    setAuthError(null);
    setErrorCode(null);
    
    // If we have a task ID, try to cancel it on the server
    if (taskId) {
      log(`Attempting to terminate task ${taskId} on server`);
      fetch(`/api/compliance/terminate-task?taskId=${taskId}`)
        .catch(error => log(`Error terminating task: ${error}`, 'error'));
    }
    
    // Clean up any status check interval
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
  }, [statusCheckInterval, taskId, log]);
  
  // Complete authentication with credentials (replaces the previous implementation)
  const completeAuth = useCallback(async (email: string, password: string): Promise<void> => {
    log(`Processing authentication for ${email} (masked password)`);
    setShowAuthForm(false);
    setIsAuthenticating(true);
    setAuthProgress(10); // Start progress
    
    try {
      // Log API call beginning (no sensitive info)
      log('Encrypting credentials for secure transmission');
      
      // Encrypt password
      const passwordData = encryptPassword(password);
      
      log('Sending authentication request to API');
      
      // Make the API call to authenticate
      const response = await fetch('/api/compliance/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          email,
          encryptedPassword: passwordData.encryptedPassword,
          nonce: passwordData.nonce,
          version: passwordData.version,
          persistBrowser: true,
          enableExtendedLogging: enableLogging
        }),
      });
      
      // Update progress after API call
      setAuthProgress(30);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication API call failed');
      }
      
      const data = await response.json();
      
      if (data.success && data.taskId) {
        log(`Authentication request accepted, task ID: ${data.taskId}`);
        setTaskId(data.taskId);
        
        // Start checking status periodically
        const interval = setInterval(() => {
          checkAuthStatus().then(isComplete => {
            if (isComplete) {
              log('Authentication status check is complete, clearing interval');
              clearInterval(interval);
              setStatusCheckInterval(null);
            }
          });
        }, 3000); // Check every 3 seconds
        
        setStatusCheckInterval(interval);
      } else {
        throw new Error(data.error || 'Failed to start authentication task');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`Authentication error: ${errorMessage}`, 'error');
      
      setAuthError(errorMessage);
      setIsAuthenticating(false);
      setAuthProgress(0);
      
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [businessId, log, onError]);
  
  // Check the authentication status
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    if (!taskId) {
      log('No task ID available, cannot check status', 'warn');
      return false;
    }
    
    try {
      log(`Checking status of task ${taskId}`);
      
      // Add cache-busting parameter
      const timestamp = Date.now();
      const response = await fetch(`/api/compliance/task-status?taskId=${taskId}&t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      log(`Received status: ${data.status}`, data.status === 'failed' ? 'error' : 'info');
      
      if (data.status === 'success') {
        // Authentication succeeded
        log('Authentication successful!', 'info');
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        setAuthProgress(100);
        
        // Save screenshot if available
        if (data.screenshot) {
          log('Screenshot captured, displaying successful login state');
          setScreenshot(data.screenshot);
        }
        
        // Save session data
        const newSessionData = {
          businessId,
          email: data.email,
          authTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
          taskId: data.taskId || taskId
        };
        setSessionData(newSessionData);
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess(newSessionData);
        }
        
        return true;
      } else if (data.status === 'failed') {
        // Authentication failed
        const errorMessage = data.error || 'Authentication failed';
        log(`Authentication failed: ${errorMessage}`, 'error');
        
        setAuthError(errorMessage);
        setIsAuthenticating(false);
        setAuthProgress(0);
        
        // Set error code if available
        if (data.errorCode) {
          setErrorCode(data.errorCode);
        }
        
        // Save screenshot if available
        if (data.screenshot) {
          log('Error screenshot captured, can help diagnose the issue');
          setScreenshot(data.screenshot);
        }
        
        // Call error callback if provided
        if (onError) {
          onError(errorMessage, data.errorCode);
        }
        
        return true;
      } else if (data.status === 'in_progress') {
        // Still in progress, update based on progress data if available
        log('Authentication in progress...');
        
        // This is a more accurate progress if the API provides it
        if (data.progress) {
          setAuthProgress(data.progress);
        } else if (data.stage) {
          // If the API provides a stage, use that to estimate progress
          const stages = {
            'initializing': 10,
            'launching_browser': 20,
            'navigating_to_google': 30,
            'entering_email': 40,
            'submitting_email': 50,
            'entering_password': 60,
            'submitting_password': 70,
            'handling_challenges': 80,
            'verifying_login': 90,
            'capturing_session': 95
          };
          
          const stageProgress = stages[data.stage as keyof typeof stages];
          if (stageProgress) {
            setAuthProgress(stageProgress);
            log(`Authentication at stage: ${data.stage} (${stageProgress}%)`);
          } else {
            // If stage is not recognized, increment progress but cap at 90%
            setAuthProgress(prev => Math.min(prev + 5, 90));
          }
        } else {
          // Otherwise increment progress but cap at 90%
          setAuthProgress(prev => Math.min(prev + 5, 90));
        }
        
        return false;
      }
      
      // Unknown status
      log(`Unknown status received: ${data.status}`, 'warn');
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`Error checking status: ${errorMessage}`, 'error');
      
      setAuthError('Failed to check authentication status: ' + errorMessage);
      setIsAuthenticating(false);
      
      // Call error callback if provided
      if (onError) {
        onError('Failed to check authentication status: ' + errorMessage);
      }
      
      return true;
    }
  }, [taskId, businessId, log, onSuccess, onError]);
  
  return {
    showAuthForm,
    isAuthenticating,
    isAuthenticated,
    authError,
    authProgress,
    taskId,
    screenshot,
    errorCode,
    sessionData,
    startAuth,
    cancelAuth,
    completeAuth,
    checkAuthStatus
  };
}

/**
 * Checks if a Google authentication session is still valid
 * 
 * @param businessId The business ID to check
 * @param sessionData Previously stored session data
 * @returns Whether the session is valid
 */
export async function isGoogleSessionValid(
  businessId: string,
  sessionData: any
): Promise<boolean> {
  if (!sessionData) return false;
  
  console.log(`[GOOGLE-AUTH] Checking session validity for business ${businessId}`);
  
  // Check if session has expired
  const expiresAt = new Date(sessionData.expiresAt).getTime();
  const now = Date.now();
  
  if (now > expiresAt) {
    console.log(`[GOOGLE-AUTH] Session for business ${businessId} has expired`);
    return false;
  }
  
  // Check if the session is still active on server
  try {
    const response = await fetch(`/api/compliance/check-session?businessId=${businessId}`);
    
    if (!response.ok) {
      console.error(`[GOOGLE-AUTH] Error checking session: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    console.error(`[GOOGLE-AUTH] Error checking session status: ${error}`);
    return false;
  }
}