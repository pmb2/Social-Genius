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
    let isActive = true; // Track if component is still mounted
    
    const initAuth = async () => {
      try {
        // Add debug for fetch status
        console.log("AuthProvider: Checking session status...");
        const sessionActive = await checkSession();
        
        // Only update state if component is still mounted
        if (!isActive) return;
        
        if (sessionActive) {
          console.log("AuthProvider: Valid session found, user is authenticated");
        } else {
          console.log("AuthProvider: No valid session found");
          setUser(null);
        }
      } catch (error) {
        // Only update state if component is still mounted
        if (!isActive) return;
        
        console.error("AuthProvider: Error during initial auth check:", error);
        setUser(null);
      } finally {
        // Only update state if component is still mounted
        if (!isActive) return;
        
        console.log("AuthProvider: Auth check complete, setting loading to false");
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
      // Check if we have a session
      try {
        console.log("[AUTH_CONTEXT] Fetching session from API...");
        
        // Add a cache-busting parameter to ensure fresh results
        const timestamp = new Date().getTime();
        const url = `/api/auth/session?t=${timestamp}`;
        
        // Add debugging for cookies before fetch
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split(';').map(c => c.trim());
          console.log("[AUTH_CONTEXT] Current cookies before fetch:", cookies);
          console.log("[AUTH_CONTEXT] Session cookie present:", cookies.some(c => c.startsWith('session=')));
          console.log("[AUTH_CONTEXT] SessionId cookie present:", cookies.some(c => c.startsWith('sessionId=')));
          
          // Log cookie values for debugging
          const sessionCookie = cookies.find(c => c.startsWith('session='));
          const sessionIdCookie = cookies.find(c => c.startsWith('sessionId='));
          if (sessionCookie) {
            const value = sessionCookie.split('=')[1];
            console.log("[AUTH_CONTEXT] Session cookie value:", value ? `${value.substring(0, 8)}...` : 'empty');
          }
          if (sessionIdCookie) {
            const value = sessionIdCookie.split('=')[1];
            console.log("[AUTH_CONTEXT] SessionId cookie value:", value ? `${value.substring(0, 8)}...` : 'empty');
          }
        }
        
        // Use a longer timeout for session check to ensure it completes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          console.log("[AUTH_CONTEXT] Sending fetch request to session API");
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
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          console.log("[AUTH_CONTEXT] Session API response status:", response.status);
          
          // Check if response is ok before trying to parse JSON
          if (!response.ok) {
            console.error('[AUTH_CONTEXT] Session API returned error:', response.status);
            // Important: Only update user state if we're sure it's invalid
            // to prevent unnecessary state changes that cause re-renders
            if (user !== null) {
              console.log('[AUTH_CONTEXT] Session API error, clearing user state');
              setUser(null);
            }
            return false;
          }
          
          const text = await response.text();
          console.log("[AUTH_CONTEXT] Session API raw response:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
          
          // Make sure we have valid JSON before parsing
          if (!text) {
            console.log('[AUTH_CONTEXT] Empty response from session API');
            if (user !== null) {
              setUser(null);
            }
            return false;
          }
          
          // Verify if cookies were properly set in the response
          console.log("[AUTH_CONTEXT] Response headers:", {
            'set-cookie': response.headers.get('set-cookie') ? 'present' : 'absent',
            'x-set-cookie': response.headers.get('x-set-cookie') ? 'present' : 'absent'
          });
          
          // Check cookies after response
          if (typeof document !== 'undefined') {
            const cookiesAfter = document.cookie.split(';').map(c => c.trim());
            console.log("[AUTH_CONTEXT] Cookies after session API call:", cookiesAfter);
            
            // Log cookie values for debugging
            const sessionCookieAfter = cookiesAfter.find(c => c.startsWith('session='));
            const sessionIdCookieAfter = cookiesAfter.find(c => c.startsWith('sessionId='));
            
            console.log("[AUTH_CONTEXT] Session cookie after API call:", 
                        sessionCookieAfter ? `present (${sessionCookieAfter.split('=')[1]?.substring(0, 8)}...)` : 'missing');
            console.log("[AUTH_CONTEXT] SessionId cookie after API call:", 
                        sessionIdCookieAfter ? `present (${sessionIdCookieAfter.split('=')[1]?.substring(0, 8)}...)` : 'missing');
          }
          
          let data;
          try {
            data = JSON.parse(text);
            console.log("[AUTH_CONTEXT] Session data parsed:", data);
          } catch (parseError) {
            console.error('[AUTH_CONTEXT] Error parsing session response:', parseError);
            if (user !== null) {
              console.log('[AUTH_CONTEXT] JSON parse error, clearing user state');
              setUser(null);
            }
            return false;
          }
          
          if (data.authenticated && data.user) {
            console.log("[AUTH_CONTEXT] Valid user found in session ID:", data.user.id, "Email:", data.user.email);
            
            // Important: Only update user state if it's different or null
            // This prevents unnecessary re-renders
            const userChanged = !user || 
                               user.id !== data.user.id || 
                               user.email !== data.user.email || 
                               user.name !== data.user.name;
                               
            if (userChanged) {
              console.log("[AUTH_CONTEXT] User state different, updating user state");
              setUser(data.user);
            } else {
              console.log("[AUTH_CONTEXT] User state unchanged, keeping current state");
            }
            
            return true;
          } else {
            console.log("[AUTH_CONTEXT] No authenticated user in session response");
            if (user !== null) {
              console.log('[AUTH_CONTEXT] Not authenticated, clearing user state');
              setUser(null);
            }
            return false;
          }
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (fetchError) {
        console.error('[AUTH_CONTEXT] Error fetching session:', fetchError);
        // Only update state if there's a change needed
        if (user !== null) {
          console.log('[AUTH_CONTEXT] Fetch error, clearing user state');
          setUser(null);
        }
        return false;
      }
    } catch (error) {
      console.error('[AUTH_CONTEXT] Session check error:', error);
      if (user !== null) {
        console.log('[AUTH_CONTEXT] General error, clearing user state');
        setUser(null);
      }
      return false;
    }
  };

  // Login function
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      
      // Call the API to login the user
      try {
        console.log('Logging in user:', email);
        
        // Hash the password client-side before sending to server
        // This is not a full security solution but adds a layer of protection
        // against plain-text password transmission
        let hashHex = '';
        
        try {
          // Check if we're in a secure context with Web Crypto API available
          if (window.crypto && window.crypto.subtle) {
            const passwordHash = await window.crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(password)
            );
            
            // Convert hash to hex string
            const hashArray = Array.from(new Uint8Array(passwordHash));
            hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          } else {
            // Fallback for non-secure contexts (development)
            console.warn('Web Crypto API not available - using fallback hashing for development only');
            // Simple development fallback - NOT secure for production!
            // In production, force HTTPS to ensure crypto.subtle is available
            hashHex = password; // This sends password as-is in development
          }
        } catch (cryptoError) {
          console.error('Crypto error:', cryptoError);
          // Fallback for error cases
          hashHex = password; // This sends password as-is in development
        }
        
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, passwordHash: hashHex }),
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
          console.log("Login successful, will redirect to dashboard");
          
          // Add debugging for cookies after login
          if (typeof document !== 'undefined') {
            console.log("Current cookies after login:", document.cookie);
          }
          
          // Important: Don't verify the session immediately after login
          // This can cause race conditions with cookie setting
          // Instead, we'll return success and let the redirect handle it
          console.log("Login successful, returning success to trigger redirect");
          
          // Force reload the session in the background after a short delay
          setTimeout(async () => {
            try {
              console.log("Background session verification after login");
              const sessionActive = await checkSession();
              console.log("Background session check result:", sessionActive ? "Active" : "Inactive");
            } catch (error) {
              console.error("Error in background session verification:", error);
            }
          }, 500);
          
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
        
        // Hash the password client-side before sending to server
        // This is not a full security solution but adds a layer of protection
        // against plain-text password transmission
        let hashHex = '';
        
        try {
          // Check if we're in a secure context with Web Crypto API available
          if (window.crypto && window.crypto.subtle) {
            const passwordHash = await window.crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(password)
            );
            
            // Convert hash to hex string
            const hashArray = Array.from(new Uint8Array(passwordHash));
            hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          } else {
            // Fallback for non-secure contexts (development)
            console.warn('Web Crypto API not available - using fallback hashing for development only');
            // Simple development fallback - NOT secure for production!
            // In production, force HTTPS to ensure crypto.subtle is available
            hashHex = password; // This sends password as-is in development
          }
        } catch (cryptoError) {
          console.error('Crypto error:', cryptoError);
          // Fallback for error cases
          hashHex = password; // This sends password as-is in development
        }
        
        // Use the real registration endpoint now that we've fixed the runtime issue
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, passwordHash: hashHex, name }),
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
          
          // Try to log in automatically - store original password to reuse
          try {
            console.log('Attempting to log in newly registered user');
            // We already have the password in memory for the auto-login
            // Since we're in the same context, we can securely reuse it without exposing it
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
