'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// Import log suppressor to reduce console spam
import '@/lib/utilities/log-suppressor';

type User = {
  id: number;
  email: string;
  name?: string;
  profilePicture?: string;
  phoneNumber?: string;
  subscription?: string;
  businessProfiles?: any[];
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  checkSession: async () => false,
});

// Context provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to determine if we should log based on environment and debug flags
  const shouldLog = (level: 'info' | 'error' | 'warn' = 'info'): boolean => {
    const isDev = process.env.NODE_ENV === 'development';
    const debugAuth = process.env.DEBUG_AUTH === 'true';
    
    return level === 'error' || // Always log errors
           (isDev && level === 'warn') || // Log warnings in development
           (isDev && debugAuth); // Only log info in dev when debug flag is enabled
  };
  
  // Controlled logging function
  const log = (message: string, level: 'info' | 'error' | 'warn' = 'info'): void => {
    if (!shouldLog(level)) return;
    
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    const prefix = `[AUTH ${timestamp}]`;
    
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  };

  // Check if the user is already logged in when the app loads
  useEffect(() => {
    log("Starting initial auth check", 'info');
    let isActive = true; // Track if component is still mounted
    
    const initAuth = async () => {
      try {
        // Add debug for fetch status
        log("Checking session status...", 'info');
        const sessionActive = await checkSession();
        
        // Only update state if component is still mounted
        if (!isActive) return;
        
        if (sessionActive) {
          log("Valid session found, user is authenticated", 'info');
        } else {
          log("No valid session found", 'info');
          setUser(null);
        }
      } catch (error) {
        // Only update state if component is still mounted
        if (!isActive) return;
        
        log(`Error during initial auth check: ${error instanceof Error ? error.message : String(error)}`, 'error');
        setUser(null);
      } finally {
        // Only update state if component is still mounted
        if (!isActive) return;
        
        log("Auth check complete, setting loading to false", 'info');
        setLoading(false);
      }
    };
    
    // Initialize auth without delay
    initAuth();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isActive = false;
    };
  }, []);

  // Function to check the current session
  const checkSession = async (): Promise<boolean> => {
    try {
      // Don't set loading true here as we're already in loading state
      // and this would cause an infinite loop if errors occur
      
      // Check if we have a session
      try {
        log("Fetching session from API...", 'info');
        
        // Add a cache-busting parameter to ensure fresh results
        const timestamp = new Date().getTime();
        const url = `/api/auth/session?t=${timestamp}`;
        
        // Add debugging for cookies before fetch - only if debug is enabled
        if (typeof document !== 'undefined' && shouldLog('info')) {
          log(`Current cookies before fetch: ${document.cookie}`, 'info');
        }
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          // Important for cookies - using include mode to ensure 
          // cookies are sent with request in both same-origin and cross-origin scenarios
          credentials: 'include', 
        });
        
        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
          log(`Session API returned error: ${response.status}`, 'error');
          return false;
        }
        
        const text = await response.text();
        
        // Only log response details if debug is enabled
        if (shouldLog('info')) {
          log(`Session API response: ${text.substring(0, 100) + (text.length > 100 ? '...' : '')}`, 'info');
        }
        
        // Make sure we have valid JSON before parsing
        if (!text) {
          log('Empty response from session API', 'warn');
          return false;
        }
        
        // Verify if cookies were properly set in the response - only if debug is enabled
        if (shouldLog('info')) {
          log(`Response headers: ${
            JSON.stringify({
              'set-cookie': response.headers.get('set-cookie'),
              'x-set-cookie': response.headers.get('x-set-cookie'),
            })
          }`, 'info');
        }
        
        const data = JSON.parse(text);
        
        // Only log parsed data if debug is enabled
        if (shouldLog('info')) {
          log(`Session data parsed: ${JSON.stringify(data)}`, 'info');
        }
        
        if (data.authenticated && data.user) {
          // Only log on first authentication or when debug is enabled
          if (shouldLog('info')) {
            log(`Valid user found in session: ${data.user.email}`, 'info');
          }
          // Ensure we only set the user if authenticated
          setUser(data.user);
          return true;
        } else {
          log("No authenticated user in session", 'info');
          setUser(null);
          return false;
        }
      } catch (fetchError) {
        log(`Error fetching session: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`, 'error');
        return false;
      }
    } catch (error) {
      log(`Session check error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      setUser(null);
      return false;
    }
    // Don't set loading false here, it should be done in the calling function
  };

  // Login function - always uses POST method to secure credentials
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      // Call the API to login the user
      try {
        // Security: Only log the email for auth troubleshooting in non-production
        if (process.env.NODE_ENV !== 'production') {
          log(`Attempting login for user: ${email}`, 'info');
        } else {
          log('Login attempt initiated', 'info');
        }
        
        // Always use POST method for login to keep credentials secure
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add security headers to prevent caching
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
          credentials: 'include', // Important for cookies
        });
        
        // Parse the response
        const data = await response.json();
        
        if (!response.ok) {
          // Security: Don't log actual error messages that might contain sensitive info
          log(`Login failed: ${response.status}`, 'error');
          return { 
            success: false, 
            error: data.error || 'Authentication failed. Please check your credentials.'
          };
        }
        
        if (data.success && data.user) {
          // Security: Don't log email in production
          if (process.env.NODE_ENV !== 'production') {
            log(`Login successful for: ${email}`, 'info');
          } else {
            log('Login successful', 'info');
          }
          
          // Set the user state with the returned user data
          setUser(data.user);
          
          // The session cookie is set by the server via Set-Cookie header
          // Don't verify session immediately as it might not be available yet in the browser
          log("Login successful, will redirect to dashboard", 'info');
          
          // Skip the session check to avoid race condition with cookie setting
          
          return { success: true };
        } else {
          log('Login endpoint returned success: false or missing user data', 'error');
          return { 
            success: false, 
            error: data.error || 'Login failed. Please try again.'
          };
        }
      } catch (apiError) {
        log(`API error during login: ${apiError instanceof Error ? apiError.message : String(apiError)}`, 'error');
        return {
          success: false,
          error: 'Server error during login. Please try again later.'
        };
      }
    } catch (error) {
      log(`Login error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (
    email: string,
    password: string,
    name?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      // Call the API to register the user
      try {
        log(`Registering new user: ${email}`, 'info');
        
        // Use the real registration endpoint now that we've fixed the runtime issue
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
          cache: 'no-store',
        });
        
        if (shouldLog('info')) {
          log(`Register API response status: ${response.status}`, 'info');
        }
        
        // Get the raw text first, then try to parse it
        const responseText = await response.text();
        
        if (shouldLog('info')) {
          log(`Register API raw response (first 100 chars): ${responseText.substring(0, 100)}`, 'info');
        }
        
        // Check if response starts with <!DOCTYPE html - that indicates an error page
        if (responseText.trimStart().startsWith('<!DOCTYPE html')) {
          log('Received HTML error page instead of JSON response', 'error');
          
          // Show a more specific error for the database connection issue
          if (responseText.includes('Error checking user records') || responseText.includes('Database connection failed')) {
            return { 
              success: false, 
              error: 'Database connection error. Please contact the administrator to ensure the database is properly configured.' 
            };
          }
          
          return { 
            success: false, 
            error: 'Server error during registration. Please try again later.' 
          };
        }
        
        // Try to parse the response
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          log(`Failed to parse register response: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 'error');
          return {
            success: false, 
            error: 'Invalid response from server. Please try again later.'
          };
        }
        
        if (!response.ok) {
          log(`Registration failed: ${data.error || response.statusText}`, 'error');
          return { 
            success: false, 
            error: data.error || 'Registration failed. Please try again.'
          };
        }
        
        if (data.success) {
          log(`Registration successful for: ${email}`, 'info');
          
          // Try to log in automatically
          try {
            log('Attempting to log in newly registered user', 'info');
            const loginResult = await login(email, password);
            if (loginResult.success) {
              log('Auto-login successful after registration', 'info');
              return { success: true };
            } else {
              log('Auto-login failed, but registration was successful', 'warn');
              return { 
                success: true, 
                error: 'Registration successful, but automatic login failed. Please log in manually.'
              };
            }
          } catch (loginError) {
            log(`Error during auto-login after registration: ${loginError instanceof Error ? loginError.message : String(loginError)}`, 'error');
            return { 
              success: true, 
              error: 'Registration successful, but automatic login failed. Please log in manually.'
            };
          }
        } else {
          log('Registration endpoint returned success: false', 'error');
          return { 
            success: false, 
            error: data.error || 'Registration failed. Please try again.'
          };
        }
      } catch (apiError) {
        log(`API error during registration: ${apiError instanceof Error ? apiError.message : String(apiError)}`, 'error');
        return {
          success: false,
          error: 'Server error during registration. Please try again later.'
        };
      }
    } catch (error) {
      log(`Registration error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed. Please try again.',
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Call logout API to invalidate the session
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include', // Important for cookies
          cache: 'no-store'
        });
        
        log('Logout API call successful', 'info');
      } catch (apiError) {
        log(`Error calling logout API: ${apiError instanceof Error ? apiError.message : String(apiError)}`, 'error');
        // Continue with local logout anyway
      }
      
      // Clear user state
      setUser(null);
      
      // No need to manually clear cookies as the server will send
      // a Set-Cookie header to clear it with an expired date
    } catch (error) {
      log(`Logout error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      // Still clear the user state even if the API call fails
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  return useContext(AuthContext);
}
