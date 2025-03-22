'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type User = {
  id: number;
  email: string;
  name?: string;
  profilePicture?: string;
  phoneNumber?: string;
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

  // Check if the user is already logged in when the app loads
  useEffect(() => {
    console.log("AuthProvider: Starting initial auth check");
    
    const initAuth = async () => {
      try {
        // Add debug for fetch status
        console.log("AuthProvider: Checking session status...");
        const sessionActive = await checkSession();
        
        if (sessionActive) {
          console.log("AuthProvider: Valid session found, user is authenticated");
        } else {
          console.log("AuthProvider: No valid session found");
          setUser(null);
        }
      } catch (error) {
        console.error("AuthProvider: Error during initial auth check:", error);
        setUser(null);
      } finally {
        console.log("AuthProvider: Auth check complete, setting loading to false");
        setLoading(false);
      }
    };
    
    // Short timeout to ensure state updates properly
    setTimeout(() => {
      initAuth();
    }, 500);
  }, []);

  // Function to check the current session
  const checkSession = async (): Promise<boolean> => {
    try {
      // Don't set loading true here as we're already in loading state
      // and this would cause an infinite loop if errors occur
      
      // Check if we have a session
      try {
        console.log("Fetching session from API...");
        
        // Add a cache-busting parameter to ensure fresh results
        const timestamp = new Date().getTime();
        const url = `/api/auth/session?t=${timestamp}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          // Important for cookies - using simpler mode 
          // to ensure it works across different environments
          credentials: 'same-origin', 
        });
        
        // Check if response is ok before trying to parse JSON
        if (!response.ok) {
          console.error('Session API returned error:', response.status);
          return false;
        }
        
        const text = await response.text();
        console.log("Session API response:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        
        // Make sure we have valid JSON before parsing
        if (!text) {
          console.log('Empty response from session API');
          return false;
        }
        
        const data = JSON.parse(text);
        console.log("Session data parsed:", data);
        
        if (data.authenticated && data.user) {
          console.log("Valid user found in session:", data.user);
          setUser(data.user);
          return true;
        } else {
          console.log("No authenticated user in session");
          setUser(null);
          return false;
        }
      } catch (fetchError) {
        console.error('Error fetching session:', fetchError);
        return false;
      }
    } catch (error) {
      console.error('Session check error:', error);
      setUser(null);
      return false;
    }
    // Don't set loading false here, it should be done in the calling function
  };

  // Login function
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      // Call the API to login the user
      try {
        console.log('Logging in user:', email);
        
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
          credentials: 'include', // Important for cookies
        });
        
        // Parse the response
        const data = await response.json();
        
        if (!response.ok) {
          console.error('Login failed:', data.error || response.statusText);
          return { 
            success: false, 
            error: data.error || 'Authentication failed. Please check your credentials.'
          };
        }
        
        if (data.success && data.user) {
          console.log('Login successful for:', email);
          
          // Set the user state with the returned user data
          setUser(data.user);
          
          // The session cookie is set by the server via Set-Cookie header
          // We don't need to do anything client-side for that
          
          return { success: true };
        } else {
          console.error('Login endpoint returned success: false or missing user data');
          return { 
            success: false, 
            error: data.error || 'Login failed. Please try again.'
          };
        }
      } catch (apiError) {
        console.error('API error during login:', apiError);
        return {
          success: false,
          error: 'Server error during login. Please try again later.'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
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
        console.log('Registering new user:', email);
        
        // Use the real registration endpoint now that we've fixed the runtime issue
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
          cache: 'no-store',
        });
        
        console.log('Register API response status:', response.status);
        
        // Get the raw text first, then try to parse it
        const responseText = await response.text();
        console.log('Register API raw response (first 100 chars):', responseText.substring(0, 100));
        
        // Check if response starts with <!DOCTYPE html - that indicates an error page
        if (responseText.trimStart().startsWith('<!DOCTYPE html')) {
          console.error('Received HTML error page instead of JSON response');
          
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
          console.error('Failed to parse register response:', parseError);
          return {
            success: false, 
            error: 'Invalid response from server. Please try again later.'
          };
        }
        
        if (!response.ok) {
          console.error('Registration failed:', data.error || response.statusText);
          return { 
            success: false, 
            error: data.error || 'Registration failed. Please try again.'
          };
        }
        
        if (data.success) {
          console.log('Registration successful for:', email);
          
          // Try to log in automatically
          try {
            console.log('Attempting to log in newly registered user');
            const loginResult = await login(email, password);
            if (loginResult.success) {
              console.log('Auto-login successful after registration');
              return { success: true };
            } else {
              console.warn('Auto-login failed, but registration was successful');
              return { 
                success: true, 
                error: 'Registration successful, but automatic login failed. Please log in manually.'
              };
            }
          } catch (loginError) {
            console.error('Error during auto-login after registration:', loginError);
            return { 
              success: true, 
              error: 'Registration successful, but automatic login failed. Please log in manually.'
            };
          }
        } else {
          console.error('Registration endpoint returned success: false');
          return { 
            success: false, 
            error: data.error || 'Registration failed. Please try again.'
          };
        }
      } catch (apiError) {
        console.error('API error during registration:', apiError);
        return {
          success: false,
          error: 'Server error during registration. Please try again later.'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
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
        
        console.log('Logout API call successful');
      } catch (apiError) {
        console.error('Error calling logout API:', apiError);
        // Continue with local logout anyway
      }
      
      // Clear user state
      setUser(null);
      
      // No need to manually clear cookies as the server will send
      // a Set-Cookie header to clear it with an expired date
    } catch (error) {
      console.error('Logout error:', error);
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
