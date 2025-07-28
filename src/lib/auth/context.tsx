'use client';

import {createContext, useContext, useEffect, useState, useCallback, ReactNode} from 'react';

type User = {
    id: string;
    email: string;
    name?: string;
    profilePicture?: string;
    phoneNumber?: string;
    businessCount?: number;
    planId?: string;
};

type AuthContextType = {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    checkSession: () => Promise<boolean>;
    updateUser: (updates: Partial<User>) => Promise<boolean>;
};

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => ({success: false}),
    register: async () => ({success: false}),
    logout: async () => {
    },
    checkSession: async () => false,
    updateUser: async () => false,
});



    

    // Context provider component
export function AuthProvider({children}: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Function to check the current session
    const checkSession = useCallback(async (): Promise<boolean> => {
        // Initialize logger with a simple stub implementation
        const logger: any = {
            logSessionActivity: (message: string, data?: any) => {
                console.log(`[SESSION] ${message}`, data);
            },
            checkSession: () => {
                // Simple cookie check function
                if (typeof document !== 'undefined') {
                    const cookies = document.cookie;
                    const sessionMatch = cookies.match(/session=([^;]+)/);
                    const sessionIdMatch = cookies.match(/sessionId=([^;]+)/);
                    return sessionMatch?.[1] || sessionIdMatch?.[1] || null;
                }
                return null;
            }
        };

        // Conditional debug logging - only enabled in development with flag
        const showDebug = process.env.NODE_ENV === 'development' && process.env.DEBUG_AUTH === 'true';

        try {
            // Check for existing cookies before making the request
            if (logger) {
                const sessionCheck = logger.checkSession();
                logger.logSessionActivity('Pre-session check', {
                    sessionCookieFound: !!sessionCheck,
                    sessionIdPrefix: sessionCheck ? sessionCheck.substring(0, 8) + '...' : 'None'
                });
            }

            // Add a cache-busting parameter to ensure fresh results
            const timestamp = new Date().getTime();
            const url = `/api/auth/session?t=${timestamp}`;

            // Use a longer timeout for session check to ensure it completes
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (increased from 10s)

            try {
                // Make an explicit no-cache request to ensure we always get fresh session data
                // Also ensure the browser sends cookies with every request to avoid session issues
                document.cookie = "cookie_check=1; path=/; SameSite=Lax;";

                // Log cookie headers before sending request
                if (logger) {
                    logger.logSessionActivity('Session check cookies', {
                        allCookies: document.cookie,
                        url: url,
                        checkTime: new Date().toISOString()
                    });
                }

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'X-Session-Check': 'true' // Custom header to identify session checks
                    },
                    credentials: 'include', // Important: Include cookies in the request
                    signal: controller.signal,
                    cache: 'no-store' // Additional no-cache setting
                });

                clearTimeout(timeoutId);

                // Check if response is ok before trying to parse JSON
                if (!response.ok) {
                    // Only log errors in development
                    if (process.env.NODE_ENV === 'development') {
                        console.error('Session API error:', response.status, response.statusText);
                        // Try to get more error details if possible
                        try {
                            const errorText = await response.text();
                            console.error('Session API error details:', errorText.substring(0, 200));
                        } catch (e) {
                            // Silently ignore read error
                        }
                    }

                    // Only update user state if it's currently not null
                    if (user !== null) {
                        setUser(null);
                    }
                    return false;
                }

                const text = await response.text();

                // Make sure we have valid JSON before parsing
                if (!text) {
                    if (showDebug) console.log('Empty response from session API');
                    if (user !== null) {
                        setUser(null);
                    }
                    return false;
                }

                let data;
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    // Always log parse errors as these indicate a real problem
                    console.error('JSON parse error:', parseError instanceof Error ? parseError.message : 'Invalid JSON');
                    console.error('Response text (first 100 chars):', text.substring(0, 100));

                    if (user !== null) {
                        setUser(null);
                    }
                    return false;
                }

                if (data.authenticated && data.user) {
                    if (showDebug) console.log('Session is valid, user authenticated');

                    // Important: Only update user state if it's different or null
                    // This prevents unnecessary re-renders
                    const userChanged = !user ||
                        user.id !== data.user.id ||
                        user.email !== data.user.email ||
                        user.name !== data.user.name;

                    if (userChanged) {
                        if (showDebug) console.log('User data changed, updating state');
                        setUser(data.user);
                    }

                    return true;
                } else {
                    if (showDebug) console.log('Session check failed: not authenticated');
                    if (user !== null) {
                        setUser(null);
                    }
                    return false;
                }
            } finally {
                clearTimeout(timeoutId);
            }
        } catch (error) {
            // Log network errors which might indicate connectivity issues
            if (process.env.NODE_ENV === 'development') {
                console.error('Session check failed:', error instanceof Error ? error.message : 'Unknown error');
                if (error instanceof Error && error.stack) {
                    console.error('Error stack:', error.stack);
                }
            }

            // If there's a network error, don't automatically log out the user
            // This prevents logging out during temporary connectivity issues
            if (error instanceof TypeError && error.message.includes('fetch')) {
                // Network error during fetch - don't change user state
                if (showDebug) console.log('Network error during session check - keeping current session state');
                return !!user; // Return true if we have a user, false otherwise
            } else {
                // For other errors, log out
                if (user !== null) {
                    setUser(null);
                }
                return false;
            }
        }
    }, [user, setUser]);

    // Check if the user is already logged in when the app loads
    // and set up periodic session refresh - but only once
    useEffect(() => {
        // Logger is temporarily disabled
        const logger: any = {
            info: (category: string, message: string) => {
                console.log(`[${category}] ${message}`);
            }
        };
        logger.info('AUTH-PROVIDER', 'Auth provider initialized');

        // Minimal logging for authentication flow
        const showDebug = process.env.NODE_ENV === 'development' && process.env.DEBUG_AUTH === 'true';
        if (showDebug) console.log("AuthProvider: Starting initial auth check");

        let isActive = true; // Track if component is still mounted
        let sessionRefreshTimer: NodeJS.Timeout | null = null;

        // Function to check session status and update state
        const checkSessionAndUpdateState = async () => {
            if (!isActive) return;

            try {
                const sessionActive = await checkSession();

                // Only update state if component is still mounted
                if (!isActive) return;

                if (!sessionActive && user !== null) {
                    setUser(null);
                }
            } catch (error) {
                // Only update state if component is still mounted
                if (!isActive) return;

                // Minimal error logging - only show in development with debugging enabled
                if (showDebug) {
                    console.error("Auth init error:", error instanceof Error ? error.message : 'Unknown error');
                }

                // Only set to null if previously not null to avoid unnecessary state changes
                if (user !== null) {
                    setUser(null);
                }
            } finally {
                // Only update state if component is still mounted
                if (!isActive) return;

                setLoading(false);
            }
        };

        // Function to set up periodic session refresh
        const setupSessionRefresh = () => {
            // Clear any existing timer
            if (sessionRefreshTimer) {
                clearInterval(sessionRefreshTimer);
            }

            // Set up a new timer that checks the session every 30 minutes
            // This ensures the session remains active during long periods of user activity
            // with minimal disruption to user experience
            sessionRefreshTimer = setInterval(() => {
                if (!isActive || !user) return; // Skip if component unmounted or no user

                // Only check if we have an active user to avoid unnecessary requests
                if (showDebug) console.log("Preparing for periodic session refresh check");

                // Check for app state issues that would disrupt the user experience
                const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                const isFocused = typeof document !== 'undefined' && document.hasFocus();
                const hasActiveInputs = typeof document !== 'undefined' &&
                    (document.activeElement instanceof HTMLInputElement ||
                        document.activeElement instanceof HTMLTextAreaElement ||
                        document.activeElement?.closest('form') !== null);

                // Create a decision log for debugging
                if (showDebug) {
                    console.log(`Session check conditions: 
            Modal open: ${isModalOpen}
            Document focused: ${isFocused}
            Active inputs: ${hasActiveInputs}`);
                }

                // Always use the silent check method that doesn't trigger page refreshes
                // This prevents modals from being interrupted during session checks
                if (showDebug) console.log("Using silent session check to prevent UI disruption");
                checkSessionSilently();
            }, 30 * 60 * 1000); // 30 minutes - doubled to reduce disruption
        };

        // A quieter version of checkSession that doesn't trigger UI updates unless necessary
        const checkSessionQuietly = async () => {
            try {
                const response = await fetch('/api/auth/session?t=' + Date.now(), {
                    method: 'GET',
                    headers: {
                        'X-Session-Check': 'quiet',
                        'Cache-Control': 'no-cache'
                    },
                    credentials: 'include'
                });

                // Only process if we got an error or session is invalid
                if (!response.ok) {
                    // Session is invalid, update state
                    if (user !== null) {
                        setUser(null);
                    }
                }
            } catch (error) {
                // Network error - don't do anything to avoid disrupting user
                if (showDebug) console.log('Quiet session check network error - continuing');
            }
        };

        // A completely silent version that never updates UI state
        // Used when modals/dialogs are open to avoid disrupting user experience
        const checkSessionSilently = async () => {
            try {
                await fetch('/api/auth/session?t=' + Date.now(), {
                    method: 'GET',
                    headers: {
                        'X-Session-Check': 'silent',
                        'Cache-Control': 'no-cache'
                    },
                    credentials: 'include'
                });
                // Do nothing with the response
                // This just keeps the session cookie alive without any state updates
            } catch (error) {
                // Completely silent - no logging, no state changes
            }
        };

        // Initialize auth without delay
        checkSessionAndUpdateState();

        // Set up the session refresh mechanism
        setupSessionRefresh();

        // Cleanup function to prevent state updates and clear timers after unmount
        return () => {
            isActive = false;
            if (sessionRefreshTimer) {
                clearInterval(sessionRefreshTimer);
            }
        };
    }, [checkSession, user, setUser]);

    // Login function
    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            setLoading(true);

            // Check if cookies are enabled before attempting login
            try {
                const timestamp = new Date().toISOString();
                document.cookie = "cookie_test=1; path=/; max-age=60";
                const cookiesEnabled = document.cookie.includes("cookie_test");

                console.log(`[AUTH ${timestamp}] Cookies ${cookiesEnabled ? 'are' : 'are NOT'} enabled before login attempt`);

                if (!cookiesEnabled) {
                    console.error(`[AUTH ${timestamp}] Cookies appear to be disabled in the browser!`);
                    return {
                        success: false,
                        error: "Cookies must be enabled in your browser to log in. Please enable cookies and try again."
                    };
                }

                // Clear any existing session cookies before login to avoid conflicts
                document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
                document.cookie = "sessionId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";

                console.log(`[AUTH ${timestamp}] Cleared any existing session cookies before login`);
            } catch (cookieError) {
                console.error('Error testing cookies before login:', cookieError);
            }

            // Import the secure credential handler
            const { secureTransmit } = await import('@/lib/utilities/secure-credential-handler');

            // Call the API to login the user using secure transmission
            try {
                const timestamp = new Date().toISOString();
                console.log(`[AUTH ${timestamp}] Logging in user:`, email);

                // Use secureTransmit to handle hashing and secure transmission
                const data = await secureTransmit('/api/auth/login', {
                    email,
                    password
                });

                if (!data.success) {
                    console.error('Login failed:', data.error);
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
                        // Log cookies and verify that we got session cookies back from the server
                        const timestamp = new Date().toISOString();
                        console.log(`[AUTH ${timestamp}] Current cookies after login:`, document.cookie);

                        // Check for session cookie
                        const hasSessionCookie = document.cookie.split(';').some(cookie =>
                            cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
                        );

                        if (!hasSessionCookie) {
                            console.error(`[AUTH ${timestamp}] ⚠️ No session cookie found after login! This will cause authentication issues.`);

                            // Try setting a test cookie to make sure cookies are working at all
                            document.cookie = "test_login=1; path=/; max-age=60";
                            const testCookieSet = document.cookie.includes("test_login");

                            if (!testCookieSet) {
                                console.error(`[AUTH ${timestamp}] ❌ Unable to set ANY cookies. Browser cookies may be disabled completely.`);
                            } else {
                                console.log(`[AUTH ${timestamp}] ✅ Test cookies work, but session cookie wasn't set by the server.`);
                            }
                        } else {
                            console.log(`[AUTH ${timestamp}] ✅ Session cookie successfully set after login`);
                        }
                    }

                    // Important: Don't verify the session immediately after login
                    // This can cause race conditions with cookie setting
                    // Instead, we'll return success and let the redirect handle it
                    console.log("Login successful, returning success to trigger redirect");

                    // Force reload the session in the background after a short delay
                    setTimeout(async () => {
                        try {
                            const timestamp = new Date().toISOString();
                            console.log(`[AUTH ${timestamp}] Background session verification after login`);

                            // Check for session cookie directly
                            const hasSessionCookie = document.cookie.split(';').some(cookie =>
                                cookie.trim().startsWith('session=') || cookie.trim().startsWith('sessionId=')
                            );

                            console.log(`[AUTH ${timestamp}] Pre-check session cookies: ${hasSessionCookie ? 'Present' : 'Missing'}`);

                            // Try to verify session through the API
                            const sessionActive = await checkSession();

                            console.log(`[AUTH ${timestamp}] Background session check result: ${sessionActive ? "Active ✅" : "Inactive ❌"}`);

                            // If session verification failed but we had a session cookie, try to diagnose
                            if (!sessionActive && hasSessionCookie) {
                                console.error(`[AUTH ${timestamp}] Strange behavior: Session cookie present but verification failed`);

                                // Try a direct test of cookies
                                const cookiesBefore = document.cookie;
                                document.cookie = "test_verification=1; path=/; max-age=60";
                                const cookiesAfter = document.cookie;

                                console.log(`[AUTH ${timestamp}] Cookie test: Before=${cookiesBefore}`);
                                console.log(`[AUTH ${timestamp}] Cookie test: After=${cookiesAfter}`);
                                console.log(`[AUTH ${timestamp}] Test cookie set?: ${cookiesAfter.includes("test_verification")}`);
                            }

                            // If no session cookie but session verification succeeded, that's strange too
                            if (sessionActive && !hasSessionCookie) {
                                console.error(`[AUTH ${timestamp}] Strange behavior: No session cookie but verification succeeded`);
                            }
                        } catch (error) {
                            console.error("Error in background session verification:", error);
                        }
                    }, 500);

                    return {success: true};
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

            // Import the secure credential handler
            const { secureTransmit } = await import('@/lib/utilities/secure-credential-handler');

            // Call the API to register the user using secure transmission
            try {
                console.log('Registering new user:', email);

                // Use secureTransmit to handle hashing and secure transmission
                const data = await secureTransmit('/api/auth/register', {
                    email,
                    password,
                    name
                });

                console.log('Register API response:', data);

                if (!data.success) {
                    console.error('Registration failed:', data.error);
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
                            return {success: true};
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

    // Update user profile
    const updateUser = async (updates: Partial<User>): Promise<boolean> => {
        try {
            if (!user) return false;

            // Update local state immediately for better UX
            setUser({...user, ...updates});

            // Call the API to update the user in the backend
            const response = await fetch('/api/auth/user', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(updates),
                credentials: 'include',
                cache: 'no-store'
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Update the user state with the response from the server
                if (data.user) {
                    setUser(prev => ({
                        ...prev,
                        ...data.user
                    }));
                }
                return true;
            } else {
                // If the API call fails, revert the local state change
                console.error('Failed to update user profile:', data.error);
                // Refresh the session to get the current user data
                await checkSession();
                return false;
            }
        } catch (error) {
            console.error('Update user error:', error);
            // Refresh the session to get the current user data
            await checkSession();
            return false;
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
                updateUser,
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
