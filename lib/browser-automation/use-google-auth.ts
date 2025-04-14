import { useState, useEffect, useCallback } from 'react';

interface UseGoogleAuthProps {
  businessId: string;
}

interface UseGoogleAuthReturn {
  showAuthForm: boolean;
  isAuthenticating: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  authProgress: number;
  taskId: string | null;
  startAuth: () => void;
  cancelAuth: () => void;
  completeAuth: (taskId: string) => void;
  checkAuthStatus: () => Promise<boolean>;
}

/**
 * Custom hook to manage Google authentication flow
 */
export function useGoogleAuth({ businessId }: UseGoogleAuthProps): UseGoogleAuthReturn {
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProgress, setAuthProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);
  
  // Start authentication flow
  const startAuth = useCallback(() => {
    setShowAuthForm(true);
    setAuthError(null);
  }, []);
  
  // Cancel authentication
  const cancelAuth = useCallback(() => {
    setShowAuthForm(false);
    setIsAuthenticating(false);
    setAuthError(null);
    
    // Clean up any status check interval
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      setStatusCheckInterval(null);
    }
  }, [statusCheckInterval]);
  
  // Called when the auth form succeeds
  const completeAuth = useCallback((newTaskId: string) => {
    setTaskId(newTaskId);
    setShowAuthForm(false);
    setIsAuthenticating(true);
    setAuthProgress(25); // Initial progress
    
    // Start checking status
    const interval = setInterval(() => {
      checkAuthStatus().then(isComplete => {
        if (isComplete) {
          clearInterval(interval);
          setStatusCheckInterval(null);
        }
      });
    }, 5000); // Check every 5 seconds
    
    setStatusCheckInterval(interval);
  }, []);
  
  // Check the authentication status
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    if (!taskId) return false;
    
    try {
      const response = await fetch(`/api/google-auth?taskId=${taskId}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        setAuthProgress(100);
        return true;
      } else if (data.status === 'failed') {
        setAuthError(data.error || 'Authentication failed');
        setIsAuthenticating(false);
        return true;
      } else if (data.status === 'in_progress') {
        // Update progress based on task status
        // This is an estimate as the actual progress depends on the browser task
        setAuthProgress(prev => Math.min(prev + 5, 90));
        return false;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthError('Failed to check authentication status');
      setIsAuthenticating(false);
      return true;
    }
  }, [taskId]);
  
  return {
    showAuthForm,
    isAuthenticating,
    isAuthenticated,
    authError,
    authProgress,
    taskId,
    startAuth,
    cancelAuth,
    completeAuth,
    checkAuthStatus
  };
}