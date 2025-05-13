"use client"

import {useState, useEffect, useMemo, useCallback, useRef, Suspense} from "react"
import {useRouter} from "next/navigation"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {ProgressCircle} from "@/components/ui/progress-circle"
import {StatusIndicator} from "@/components/ui/status-indicator"
import {SubscriptionUpgradeModal} from "@/components/subscription/subscription-upgrade-modal"
import {useAuth} from "@/lib/auth"
import {subscriptionPlans} from "@/services/subscription/plans"
import {encryptPassword} from "@/utils/password-encryption"
// Import specific icons instead of the whole library to reduce bundle size
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import MailIcon from "lucide-react/dist/esm/icons/mail"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import Image from "next/image"
import dynamic from "next/dynamic"

// Dynamically import heavy components to reduce initial load time
const BusinessProfileModal = dynamic(() => import("./modal"), {
    loading: () => <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>,
    ssr: false
})

// Will be populated from API
const initialBusinessAccounts: Business[] = []

// Define Business type
type Business = {
    id: number;
    businessId: string;
    name: string;
    status: string;
    createdAt: string;
    authStatus?: 'logged_in' | 'pending' | 'failed';
    browserInstance?: string;
    _modalOpenTime?: number; // Track when modal was opened to detect changes
}

interface BusinessProfileDashboardProps {
    onBusinessCountChange?: (count: number) => void;
}

export function BusinessProfileDashboard({ onBusinessCountChange }: BusinessProfileDashboardProps) {
    // Import router for client-side navigation without full page reloads
    const router = useRouter();
    
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false)
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
    const [businessName, setBusinessName] = useState("")
    const [businessEmail, setBusinessEmail] = useState("")
    const [businessType, setBusinessType] = useState("google") // "google" or "invite"
    const [businesses, setBusinesses] = useState<Business[]>(initialBusinessAccounts)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
    const [limitError, setLimitError] = useState<{
        currentSubscription: string;
        requiredSubscription: string;
        currentCount: number;
        maxAllowed: number;
    } | null>(null);

    // Google Auth related states
    const [googleEmail, setGoogleEmail] = useState("")
    const [googlePassword, setGooglePassword] = useState("")
    const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
    const [authError, setAuthError] = useState("")
    const [isGoogleAuthStep, setIsGoogleAuthStep] = useState(false)
    const [autoLoginAttempted, setAutoLoginAttempted] = useState(false)
    const [authScreenshots, setAuthScreenshots] = useState<Record<string, string> | null>(null)
    const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false)
    const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null)
    
    // Track if component is mounted to prevent operations after unmount
    const isMounted = useRef(true);

    // Auth and subscription data
    const {user} = useAuth();
    const userSubscription = user?.subscription || 'basic';
    const currentPlan = subscriptionPlans.find(plan => plan.id === userSubscription) || subscriptionPlans[0];
    const locationLimit = currentPlan.businessLimit;

    // Controlled logging function that respects environment and logs with timestamps
    const log = (message: string, level: 'info' | 'error' | 'warn' = 'info'): void => {
        const isDev = process.env.NODE_ENV === 'development';
        const debugBusiness = process.env.DEBUG_BUSINESS === 'true';

        // Determine if we should log
        const shouldLog = level === 'error' || // Always log errors
            (isDev && level === 'warn') || // Log warnings in dev
            (isDev && debugBusiness && level === 'info'); // Only log info if debug flag is on

        if (!shouldLog) return;

        // Add timestamp to message
        const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
        const prefix = `[BUSINESS ${timestamp}]`;

        if (level === 'error') {
            console.error(`${prefix} ${message}`);
        } else if (level === 'warn') {
            console.warn(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    };

    // Function to fetch businesses from API with caching - memoized to avoid dependency issues
    const fetchBusinesses = useCallback(async (skipCache = false) => {
        try {
            setIsLoading(true);
            setError(null);

            // Generate cache key based on the current user (would be better with user ID)
            const cacheKey = 'user_businesses_cache';

            // Try to get from session storage cache first (client-side only) if not skipping cache
            let cachedData = null;
            // Increase cache time to 15 minutes to prevent frequent refreshes
            // This is a significant change to reduce API calls and prevent refreshes
            const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
            
            if (!skipCache && typeof window !== 'undefined') {
                try {
                    const cachedJson = sessionStorage.getItem(cacheKey);
                    if (cachedJson) {
                        const cached = JSON.parse(cachedJson);
                        // Use cache if it's less than 15 minutes old
                        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
                            cachedData = cached.data;
                            log(`Using cached data (expires in ${Math.round((cached.timestamp + CACHE_DURATION_MS - Date.now())/1000/60)} minutes)`, 'info');
                        } else {
                            log('Cache expired, will fetch fresh data', 'info');
                        }
                    }
                } catch (e) {
                    log('Error reading from cache: ' + String(e), 'warn');
                }
            }

            // If we have valid cached data, use it
            if (!skipCache && cachedData) {
                // Only log when debug is enabled
                if (cachedData.businesses?.length > 0) {
                    log(`Using cached businesses data (${cachedData.businesses.length} items)`, 'info');
                }

                if (cachedData.businesses) {

                    // Sort businesses with priority:
                    // 1. Failed auth status first (need attention)
                    // 2. Then by creation date (newest first)
                    const sortedBusinesses = [...cachedData.businesses].sort((a, b) => {
                        // First sort by auth status - failed auth businesses first
                        if (a.authStatus === 'failed' && b.authStatus !== 'failed') return -1;
                        if (a.authStatus !== 'failed' && b.authStatus === 'failed') return 1;

                        // Then sort by creation date (newest first)
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    });

                    setBusinesses(sortedBusinesses);
                    
                    // Notify parent component about the business count
                    if (onBusinessCountChange) {
                        onBusinessCountChange(sortedBusinesses.length);
                    }
                    
                    setIsLoading(false);
                    return;
                }
            }

            // If no cache or expired, fetch from API
            log('Fetching businesses for current user...', 'info');

            // Ensure we have a valid session cookie before making the request
            if (typeof document !== 'undefined') {
                // Check if session cookie exists
                const hasCookie = document.cookie.includes('session=') || document.cookie.includes('sessionId=');
                if (!hasCookie) {
                    log('Session cookie not found, refreshing session before API call', 'warn');
                    try {
                        // Try to refresh the session silently
                        await fetch('/api/auth/session?t=' + Date.now(), {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache'
                            }
                        });
                        log('Session refreshed before API call', 'info');
                    } catch (sessionError) {
                        log('Failed to refresh session: ' + String(sessionError), 'error');
                    }
                }
            }

            // Add cache-busting parameter and cache control
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/businesses?t=${timestamp}`, {
                method: 'GET',
                credentials: 'include', // Include cookies for authentication
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'X-Requested-With': 'XMLHttpRequest' // Add this to help identify AJAX requests
                }
            });

            const data = await response.json();

            if (!response.ok) {
                log(`Error response from businesses API: ${response.status} ${response.statusText}`, 'error');

                // If authentication error, try to refresh the session
                if (response.status === 401 && (data.error === 'Invalid or expired session' || data.error === 'Authentication required')) {
                    log('Authentication error detected during fetch', 'error');
                    
                    // Use Next.js router instead of window.location to prevent page refresh
                    // Only navigate if component is still mounted
                    if (isMounted.current) {
                        router.push('/auth?reason=session_expired');
                    }
                    
                    throw new Error('Session expired. Please log in again.');
                }

                throw new Error(`Failed to fetch businesses: ${response.status} ${response.statusText}`);
            }
            log(`Fetched ${data.businesses?.length || 0} businesses from API`, 'info');

            // Save to session storage cache
            if (typeof window !== 'undefined') {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        data,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    log('Error writing to cache: ' + String(e), 'warn');
                }
            }

            if (data.businesses) {
                // Sort businesses with priority:
                // 1. Failed auth status first (need attention)
                // 2. Then by creation date (newest first)
                const sortedBusinesses = [...data.businesses].sort((a, b) => {
                    // First sort by auth status - failed auth businesses first
                    if (a.authStatus === 'failed' && b.authStatus !== 'failed') return -1;
                    if (a.authStatus !== 'failed' && b.authStatus === 'failed') return 1;

                    // Then sort by creation date (newest first)
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });

                setBusinesses(sortedBusinesses);
                
                // Notify parent component about the business count
                if (onBusinessCountChange) {
                    onBusinessCountChange(sortedBusinesses.length);
                }
            } else {
                setBusinesses([]);
                
                // Notify parent component about zero businesses
                if (onBusinessCountChange) {
                    onBusinessCountChange(0);
                }
            }
        } catch (err) {
            log(`Error fetching businesses: ${err instanceof Error ? err.message : String(err)}`, 'error');
            setError('Failed to load businesses. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Function to attempt auto-login for all businesses - memoized to prevent dependency issues
    const tryAutoLoginForAllBusinesses = useCallback(async () => {
        // Don't do anything if no businesses
        if (!businesses || businesses.length === 0) return;

        log(`Starting auto-login attempts for ${businesses.length} businesses`, 'info');

        // Count successful and failed attempts for a single summary message
        let successCount = 0;
        let failureCount = 0;
        let skippedCount = 0;

        log(`Starting auto-login process for businesses`, 'info');

        // Try auto-login for each business, one at a time to avoid overwhelming the server
        for (const business of businesses) {
            try {
                // Skip businesses already marked as logged in
                if (business.authStatus === 'logged_in') {
                    skippedCount++;
                    continue;
                }

                // Implement retry logic for auto-login
                let response;
                let result;
                let retries = 0;
                const maxRetries = 2; // Maximum number of retry attempts

                while (retries <= maxRetries) {
                    try {
                        // Attempt auto-login with incrementing delay between retries
                        if (retries > 0) {
                            log(`Retry ${retries}/${maxRetries} for business ${business.id}`, 'info');
                        }

                        response = await fetch('/api/compliance/auto-login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                businessId: business.id,
                                retry: retries > 0 // Indicate this is a retry attempt
                            }),
                        });

                        // Process the result
                        result = await response.json();

                        // If successful or not a 400 error that we can retry, break out of the loop
                        if (result.success || !result.errorCode || !result.errorCode.includes('400_ERROR')) {
                            break;
                        }

                        // If we get here, it's a retryable 400 error
                        retries++;

                        // Exponential backoff with jitter
                        const delay = Math.min(1000 * Math.pow(2, retries), 5000) + Math.random() * 500;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } catch (retryError) {
                        // Log the error and continue to the next retry
                        log(`Error during auto-login retry ${retries} for business ${business.id}: ${retryError instanceof Error ? retryError.message : String(retryError)}`, 'error');
                        retries++;

                        // Create a basic result object for error cases
                        result = {
                            success: false,
                            error: retryError instanceof Error ? retryError.message : 'Network error during login attempt'
                        };

                        // Don't retry network/fetch errors, just break
                        break;
                    }
                }

                // Update our counters
                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
                    // Log failures with warning level
                    log(`Auto-login failed for ${business.name}: ${result.error || 'Unknown error'}`, 'warn');
                }

                // Add a short delay between requests to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                failureCount++;
                // Always log errors
                log(`Error during auto-login for business ${business.id}: ${error instanceof Error ? error.message : String(error)}`, 'error');
            }
        }

        // Provide a single summary log instead of individual logs
        log(`Auto-login summary: ${successCount} succeeded, ${failureCount} failed, ${skippedCount} skipped`, 'info');

        // Small delay before refresh to ensure backend has processed all login attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
        fetchBusinesses(true);
    }, [businesses, fetchBusinesses]);

    // Fetch businesses on component mount - only once
    useEffect(() => {
        // Set a flag in session storage to track initial data load
        const businessesLoaded = sessionStorage.getItem('businessesInitiallyLoaded') === 'true';
        
        // Fetch businesses on first load or if forced refresh
        if (!businessesLoaded) {
            fetchBusinesses();
            // Mark as loaded to prevent unnecessary refreshes
            sessionStorage.setItem('businessesInitiallyLoaded', 'true');
        } else {
            // Still try to use cached data without forcing API refresh
            fetchBusinesses(false);
        }
    }, [fetchBusinesses]);

    // Attempt auto-login for all businesses when the list is first loaded
    // But only on first load, NOT on refresh
    useEffect(() => {
        // Store a flag in sessionStorage to track if we've already tried auto-login
        // in this browser session to prevent repeated attempts
        if (typeof window !== 'undefined') {
            // Check browser session storage first
            const alreadyAttempted = sessionStorage.getItem('autoLoginAttempted') === 'true';
            
            if (alreadyAttempted) {
                // If we've already attempted in this session, just mark as attempted locally
                // without triggering any state updates or additional processing
                if (!autoLoginAttempted) {
                    setAutoLoginAttempted(true);
                }
                return;
            }
            
            // Only run this effect if we have businesses, aren't in loading state,
            // and haven't attempted auto-login yet
            if (businesses.length > 0 && !isLoading && !autoLoginAttempted) {
                log(`Starting automatic login process for all businesses`, 'info');
                
                // Mark as attempted to prevent infinite loop
                setAutoLoginAttempted(true);
                
                // Store in session storage immediately to prevent repeated attempts
                // even if the page refreshes before the timeout completes
                sessionStorage.setItem('autoLoginAttempted', 'true');
                
                // Delay auto-login to ensure UI is responsive
                // Use a longer delay and check if modals are open before attempting login
                const timer = setTimeout(() => {
                    // Only proceed with auto-login if no modal is open
                    if (typeof window !== 'undefined' && !window.__modalOpen) {
                        tryAutoLoginForAllBusinesses();
                    } else {
                        // If a modal is open, skip the auto-login to avoid disrupting the user
                        log("Skipping auto-login because a modal is open", 'info');
                    }
                }, 15000); // Increased to 15 seconds to reduce chances of conflict
                
                // Clean up the timer if the component unmounts
                return () => clearTimeout(timer);
            }
        }
    }, [businesses.length, isLoading, autoLoginAttempted, tryAutoLoginForAllBusinesses]);
    
    // Cleanup on unmount to prevent memory leaks and state updates after unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const handleCloseUpgradeModal = () => {
        setIsUpgradeModalOpen(false);
        setLimitError(null);
    };

    const handleAddBusiness = async () => {
        try {
            // First ensure we have a valid session
            if (typeof document !== 'undefined') {
                // Check if session cookie exists
                const hasCookie = document.cookie.includes('session=') || document.cookie.includes('sessionId=');
                if (!hasCookie) {
                    log('Session cookie not found before adding business, refreshing session', 'warn');
                    try {
                        // Try to refresh the session silently
                        const response = await fetch('/api/auth/session?t=' + Date.now(), {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache'
                            }
                        });
                        
                        if (!response.ok) {
                            // If we can't get a valid session, redirect to login
                            log('Failed to refresh session, redirecting to login', 'error');
                            if (typeof window !== 'undefined') {
                                router.push('/auth?reason=session_expired');
                                return;
                            }
                        }
                        
                        log('Session refreshed before adding business', 'info');
                    } catch (sessionError) {
                        log('Failed to refresh session: ' + String(sessionError), 'error');
                        // Proceed anyway and let the API call handle potential auth errors
                    }
                }
            }
            
            // Check subscription limits first
            if (locationLimit !== null && businesses.length >= locationLimit) {
                // Find the next tier that would allow more businesses
                const nextTier = subscriptionPlans.find(plan =>
                    plan.businessLimit > locationLimit
                );

                setLimitError({
                    currentSubscription: userSubscription,
                    requiredSubscription: nextTier?.id || 'enterprise',
                    currentCount: businesses.length,
                    maxAllowed: locationLimit
                });

                setIsUpgradeModalOpen(true);
                return;
            }

            // First step - collect business name
            if (!isGoogleAuthStep) {
                log(`Starting to add new business: "${businessName}" (type: ${businessType})`, 'info');

                if (!businessName.trim()) {
                    alert('Please enter a business name');
                    return;
                }

                if (businessType === "invite") {
                    if (!businessEmail.trim()) {
                        alert('Please enter a business email');
                        return;
                    }

                    // For email invites, proceed with the original flow
                    await addBusinessToSystem();
                    return;
                }

                // For Google Business Profile, move to step 2 (Google auth) without creating business yet
                // We'll only create the business after successful authentication
                setIsGoogleAuthStep(true);
                return;
            }

            // Second step - Google authentication
            if (isGoogleAuthStep) {
                // Validate email format first with comprehensive checks
                if (!googleEmail || !googleEmail.trim()) {
                    setAuthError("Please enter your Google email address");
                    return;
                }

                // Comprehensive email validation for Google accounts
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(googleEmail)) {
                    setAuthError("Please enter a valid email address");
                    return;
                }

                // Google accounts typically end with gmail.com, googlemail.com, or a Google Workspace domain
                if (!googleEmail.includes('@gmail.com') &&
                    !googleEmail.includes('@googlemail.com') &&
                    !googleEmail.includes('@google.com') &&
                    !confirm("The email address you entered doesn't appear to be a Gmail account. Are you sure you want to proceed?")) {
                    return;
                }

                // Validate password
                if (!googlePassword) {
                    setAuthError("Please enter your password");
                    return;
                }

                if (googlePassword.length < 6) {
                    setAuthError("Password must be at least 6 characters long");
                    return;
                }

                setIsAuthSubmitting(true);
                setAuthError("");

                try {
                    setAuthError("");
                    log(`🔐 Attempting to authenticate with Google first, before creating business: "${businessName}"`, 'info');

                    // Create a temporary browser instance ID that we'll use for authentication
                    // This ID will be persisted and associated with the business
                    const tempBrowserInstanceId = `temp-gbp-${Date.now()}`;
                    log(`🧩 Generated browser instance ID: ${tempBrowserInstanceId}`, 'info');
                    
                    // Store the instance ID to use in subsequent requests
                    let browserInstanceId = tempBrowserInstanceId;
                    
                    // Track authentication steps for debugging
                    log(`📋 Authentication flow begins - Step 1: Pre-validate Google credentials`, 'info');

                    // Encrypt the password before sending
                    const passwordData = encryptPassword(googlePassword);

                    // Call auth API directly without a business ID first, to validate credentials
                    log(`📤 Sending pre-auth validation request to /api/compliance/auth-validate`, 'info');
                    log(`📧 Email: ${googleEmail}, Password encrypted: ${!!passwordData.encryptedPassword}`, 'info');
                    
                    // First, ensure we have a valid session
                    if (typeof document !== 'undefined') {
                        // Check if session cookie exists
                        const hasCookie = document.cookie.includes('session=') || document.cookie.includes('sessionId=');
                        if (!hasCookie) {
                            log('No session cookie found before auth validation, refreshing session', 'warn');
                            try {
                                // Try to refresh the session silently
                                await fetch('/api/auth/session?t=' + Date.now(), {
                                    method: 'GET',
                                    credentials: 'include',
                                    headers: {
                                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                                        'Pragma': 'no-cache'
                                    }
                                });
                                log('Session refreshed before API call', 'info');
                            } catch (sessionError) {
                                log('Failed to refresh session: ' + String(sessionError), 'error');
                            }
                        }
                    }
                    
                    const preAuthResponse = await fetch('/api/compliance/auth-validate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'X-Requested-With': 'XMLHttpRequest' // Add this to help identify AJAX requests
                        },
                        credentials: 'include', // Explicitly include credentials for authentication
                        body: JSON.stringify({
                            email: googleEmail,
                            encryptedPassword: passwordData.encryptedPassword,
                            nonce: passwordData.nonce,
                            version: passwordData.version,
                            browserInstanceId: tempBrowserInstanceId
                        }),
                    });

                    log(`📥 Received pre-auth response with status: ${preAuthResponse.status}`, 'info');
                    const preAuthResult = await preAuthResponse.json();
                    log(`📊 Pre-auth result: ${preAuthResult.success ? 'Success' : 'Failed'}`, preAuthResult.success ? 'info' : 'warn');
                    
                    // If the API provided a browser instance ID, use it
                    if (preAuthResult.browserInstanceId) {
                        log(`🔄 Updating browser instance ID from API: ${preAuthResult.browserInstanceId}`, 'info');
                        browserInstanceId = preAuthResult.browserInstanceId;
                    }

                    // If pre-auth validation fails, stop here without creating business
                    if (!preAuthResponse.ok || !preAuthResult.success) {
                        const errorMessage = preAuthResult.error || "Authentication failed. Please check your credentials and try again.";
                        setAuthError(errorMessage);
                        throw new Error(errorMessage);
                    }
                    
                    // Update browserInstanceId if the pre-auth response provided a new one
                    if (preAuthResult.browserInstanceId) {
                        browserInstanceId = preAuthResult.browserInstanceId;
                        log(`Using browser instance ID from pre-auth: ${browserInstanceId}`, 'info');
                    }

                    // Authentication successful, now create the business
                    log('📋 Step 2: Google authentication validated, creating business record', 'info');
                    const businessData = await addBusinessToSystem();

                    if (!businessData.success) {
                        log(`❌ Failed to create business record: ${businessData.error}`, 'error');
                        throw new Error(businessData.error || "Failed to create business record");
                    }

                    // Then finalize authentication with the new business ID
                    const businessId = businessData.businessId;
                    log(`✅ Business created successfully with ID: ${businessId}`, 'info');
                    log(`📋 Step 3: Finalizing Google Business Profile authentication for business ID: ${businessId}`, 'info');

                    // Encrypt the password again before sending (don't reuse the previous token)
                    const finalPasswordData = encryptPassword(googlePassword);

                    // Check session again before final auth call
                    if (typeof document !== 'undefined') {
                        // Check if session cookie exists
                        const hasCookie = document.cookie.includes('session=') || document.cookie.includes('sessionId=');
                        if (!hasCookie) {
                            log('No session cookie found before final auth call, refreshing session', 'warn');
                            try {
                                // Try to refresh the session silently
                                await fetch('/api/auth/session?t=' + Date.now(), {
                                    method: 'GET',
                                    credentials: 'include',
                                    headers: {
                                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                                        'Pragma': 'no-cache'
                                    }
                                });
                                log('Session refreshed before final auth call', 'info');
                            } catch (sessionError) {
                                log('Failed to refresh session: ' + String(sessionError), 'error');
                            }
                        }
                    }

                    // Call the auth API with the business ID, reusing the browser instance
                    log(`📤 Sending final auth request to /api/compliance/auth with browser instance ID: ${browserInstanceId}`, 'info');
                    
                    const authResponse = await fetch('/api/compliance/auth', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'X-Requested-With': 'XMLHttpRequest' // Add this to help identify AJAX requests
                        },
                        credentials: 'include', // Explicitly include credentials for authentication
                        body: JSON.stringify({
                            businessId,
                            email: googleEmail,
                            encryptedPassword: finalPasswordData.encryptedPassword,
                            nonce: finalPasswordData.nonce,
                            version: finalPasswordData.version,
                            browserInstanceId, // Reuse the same browser instance from pre-auth
                            persistBrowser: true // Flag to indicate browser should persist
                        }),
                    });

                    log(`📥 Received auth response with status: ${authResponse.status}`, 'info');
                    const authResult = await authResponse.json();
                    log(`📊 Auth result: ${authResult.success ? '✅ Success' : '❌ Failed'}`, authResult.success ? 'info' : 'error');

                    if (!authResponse.ok || !authResult.success) {
                        // Format error message based on error code
                        let errorMessage = authResult.error || "Authentication failed. Please try again.";
                        log(`❌ Auth error details: ${JSON.stringify({
                            error: authResult.error,
                            errorCode: authResult.errorCode,
                            status: authResponse.status
                        })}`, 'error');

                        if (authResult.errorCode === 'INVALID_CREDENTIALS') {
                            log(`❌ Invalid credentials detected`, 'error');
                            errorMessage = "The email or password you entered is incorrect. Please check your credentials and try again.";
                        } else if (authResult.errorCode === 'ACCOUNT_LOCKED') {
                            log(`❌ Account locked detected`, 'error');
                            errorMessage = "Your account has been temporarily locked due to too many failed attempts. Please try again in 30 minutes or reset your password through Google.";
                        } else if (authResult.errorCode === 'BROWSER_LAUNCH_FAILED') {
                            log(`❌ Browser launch failure detected`, 'error');
                            errorMessage = "Failed to initialize the browser. Please try again or contact support.";
                        } else {
                            log(`❌ Unknown error type: ${errorMessage}`, 'error');
                        }

                        // Clean up the temporary business record since authentication failed
                        try {
                            log(`Authentication failed - removing temporary business record for ID: ${businessId}`, 'info');
                            const cleanupResponse = await fetch(`/api/businesses?businessId=${businessId}`, {
                                method: 'DELETE',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                credentials: 'include', // Include cookies for authentication
                            });

                            if (cleanupResponse.ok) {
                                log(`Successfully removed temporary business record for ID: ${businessId}`, 'info');
                            } else {
                                log(`Failed to remove temporary business with status: ${cleanupResponse.status}`, 'warn');
                            }
                        } catch (cleanupError) {
                            log(`Failed to remove temporary business record: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`, 'error');
                        }

                        throw new Error(errorMessage);
                    }

                    log(`🎉 Google Business Profile authenticated successfully for business ID: ${businessId}`, 'info');
                    log(`📋 Authentication flow completed successfully!`, 'info');
                    
                    // If the response includes a browser instance ID, store it
                    if (authResult.browserInstanceId) {
                        log(`💾 Storing browser instance ID: ${authResult.browserInstanceId} for business ${businessId}`, 'info');
                        
                        // In a real app, we would store this in local storage or a cookie
                        try {
                            // Try to store in sessionStorage for temporary persistence
                            if (typeof window !== 'undefined' && window.sessionStorage) {
                                const key = `business_${businessId}_browser`;
                                window.sessionStorage.setItem(key, authResult.browserInstanceId);
                                log(`✅ Browser instance ID stored in session storage with key: ${key}`, 'info');
                            }
                        } catch (storageError) {
                            // Just log but continue - this is not critical
                            log(`⚠️ Could not store browser instance in session storage: ${storageError}`, 'warn');
                        }
                    } else {
                        log(`⚠️ No browser instance ID returned from API`, 'warn');
                    }

                    // Reset form and close modal
                    resetForm();

                    // Refresh the business list with a delay
                    setTimeout(() => {
                        log('Refreshing businesses list after adding authenticated business', 'info');
                        fetchBusinesses(true);
                    }, 1000);

                    // Show success message
                    alert('Business added and Google account authenticated successfully!');
                    
                    // Try to fetch authentication screenshots for debugging
                    if (authResult?.taskId) {
                        try {
                            const screenshotsResponse = await fetch(`/api/compliance/auth-screenshots?taskId=${authResult.taskId}&businessId=${authResult.businessId}`, {
                                method: 'GET',
                                credentials: 'include',
                                headers: {
                                    'Cache-Control': 'no-cache',
                                    'X-Requested-With': 'XMLHttpRequest'
                                }
                            });
                            
                            if (screenshotsResponse.ok) {
                                const screenshotsData = await screenshotsResponse.json();
                                if (screenshotsData.screenshots) {
                                    setAuthScreenshots(screenshotsData.screenshots);
                                    const screenshotCount = Object.keys(screenshotsData.screenshots).length;
                                    log(`Retrieved ${screenshotCount} authentication screenshots`, 'info');
                                    
                                    // Show confirmation with screenshot viewing option
                                    if (screenshotCount > 0 && window.confirm('Authentication successful! Would you like to view the authentication screenshots for debugging?')) {
                                        setIsScreenshotModalOpen(true);
                                    }
                                }
                            }
                        } catch (screenshotError) {
                            log(`Failed to fetch authentication screenshots: ${String(screenshotError)}`, 'warn');
                        }
                    }
                } finally {
                    setIsAuthSubmitting(false);
                }
            }
        } catch (err) {
            log(`❌ Error adding business: ${err instanceof Error ? err.message : String(err)}`, 'error');
            
            // Include stack trace for debugging in development
            if (err instanceof Error && err.stack) {
                log(`Stack trace: ${err.stack}`, 'error');
            }
            
            // Try to identify specific types of errors for better user feedback
            let userErrorMessage = 'Unknown error occurred';
            
            if (err instanceof Error) {
                // Network/Connection Errors
                if (err.message.includes('Network') || err.message.includes('fetch')) {
                    userErrorMessage = 'Network error. Please check your connection and try again.';
                    log(`🔍 Network error detected`, 'error');
                } 
                // Timeout Errors
                else if (err.message.includes('timeout')) {
                    userErrorMessage = 'The operation timed out. Please try again.';
                    log(`🔍 Timeout error detected`, 'error');
                } 
                // Authentication Errors
                else if (err.message.includes('401') || err.message.includes('auth') || 
                         err.message.includes('authenticate')) {
                    userErrorMessage = 'Authentication error. Please check your credentials and try again.';
                    log(`🔍 Auth error detected`, 'error');
                } 
                // Google-specific errors with recovery suggestions
                else if (err.message.includes('2FA') || err.message.includes('two-factor') || 
                         err.message.includes('verification')) {
                    userErrorMessage = 'Two-factor authentication is enabled on your Google account. ' +
                                      'Please temporarily disable it for the initial connection, then re-enable it.';
                    log(`🔍 2FA error detected`, 'error');
                }
                else if (err.message.includes('captcha') || err.message.includes('CAPTCHA')) {
                    userErrorMessage = 'A CAPTCHA challenge was detected. Please try again in a few minutes or ' +
                                      'login to your Google account manually first, then retry.';
                    log(`🔍 CAPTCHA error detected`, 'error');
                }
                else if (err.message.includes('suspicious') || err.message.includes('unusual')) {
                    userErrorMessage = 'Google detected suspicious activity. Please login to your ' +
                                      'Google account manually first to resolve any security issues, then retry.';
                    log(`🔍 Security challenge detected`, 'error');
                }
                else if (err.message.includes('locked') || err.message.includes('disabled')) {
                    userErrorMessage = 'Your Google account appears to be locked or disabled. ' +
                                      'Please resolve this issue directly with Google before retrying.';
                    log(`🔍 Account locked/disabled error detected`, 'error');
                }
                else {
                    userErrorMessage = err.message;
                }
            } else {
                userErrorMessage = String(err);
            }
            
            log(`⚠️ Setting user-facing error message: ${userErrorMessage}`, 'warn');
            setAuthError(userErrorMessage);
        }
    }

    // Helper function to add business to the system
    const addBusinessToSystem = async () => {
        log(`🏢 Adding new business: "${businessName}" (type: ${businessType})`, 'info');

        // Show a loading state
        setIsLoading(true);

        try {
            // Validate email for Google business type
            if (businessType === 'google' && (!googleEmail || !googleEmail.includes('@'))) {
                log(`❌ Email validation failed: "${googleEmail}"`, 'error');
                throw new Error('Email field not found or invalid');
            }
            
            log(`✅ Input validation passed`, 'info');

            // Call the API to add the business with improved headers
            log('📤 Sending request to /api/businesses endpoint', 'info');
            log(`Request details: ${JSON.stringify({
                name: businessName.trim(),
                type: businessType,
                email: businessType === "invite" ? businessEmail.trim() : undefined,
                authPending: businessType === "google"
            })}`, 'info');
            
            // Ensure we have a valid session cookie before making the request
            if (typeof document !== 'undefined') {
                // Check if session cookie exists
                const hasCookie = document.cookie.includes('session=') || document.cookie.includes('sessionId=');
                if (!hasCookie) {
                    log('No session cookie found before API call, attempting to refresh session', 'warn');
                    try {
                        const sessionResponse = await fetch('/api/auth/session?t=' + Date.now(), {
                            method: 'GET',
                            credentials: 'include',
                            headers: {
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache'
                            }
                        });
                        
                        if (!sessionResponse.ok) {
                            log('Session refresh failed with status: ' + sessionResponse.status, 'error');
                            throw new Error('Session error. Please try again.');
                        }
                        
                        log('Session refreshed successfully before API call', 'info');
                    } catch (sessionError) {
                        log('Session refresh failed: ' + String(sessionError), 'error');
                        throw new Error('Session error. Please try again.');
                    }
                }
            }
            
            const response = await fetch('/api/businesses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'X-Requested-With': 'XMLHttpRequest' // Add this to help identify AJAX requests
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                    name: businessName.trim(),
                    type: businessType,
                    email: businessType === "invite" ? businessEmail.trim() : undefined,
                    authPending: businessType === "google" // Flag to indicate auth will follow
                }),
            });
            
            // Log response status for debugging
            log(`📥 Received response with status: ${response.status} (${response.statusText})`, 'info');

            // Parse the response
            let data;
            try {
                const responseText = await response.text();
                log(`📄 Raw response text: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`, 'info');
                
                // Try to parse JSON
                data = JSON.parse(responseText);
                log(`📊 Parsed response data: ${JSON.stringify(data)}`, 'info');
            } catch (parseError) {
                log(`❌ Error parsing response: ${parseError}`, 'error');
                throw new Error(`Failed to parse API response: ${parseError.message}`);
            }

            if (!response.ok) {
                // Check if this is a subscription limit error
                if (response.status === 403 && data.limitReached) {
                    // Set limit error state
                    setLimitError({
                        currentSubscription: data.currentSubscription || userSubscription,
                        requiredSubscription: data.requiredSubscription || 'enterprise',
                        currentCount: data.currentCount || businesses.length,
                        maxAllowed: data.maxAllowed || locationLimit
                    });

                    // Show upgrade modal
                    setIsUpgradeModalOpen(true);

                    // Reset loading state
                    setIsLoading(false);

                    // Close the add business modal
                    setIsAddBusinessModalOpen(false);

                    return {success: false, error: data.error};
                }

                // If authentication error, try to refresh the session
                if (response.status === 401 && (data.error === 'Invalid or expired session' || data.error === 'Authentication required')) {
                    log('Authentication error detected, trying to refresh session...', 'warn');

                    // Try to check session from the API with improved headers
                    const sessionResponse = await fetch('/api/auth/session?t=' + new Date().getTime(), {
                        method: 'GET',
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0'
                        },
                        credentials: 'include',
                    });

                    if (!sessionResponse.ok) {
                        log('Session refresh failed, redirecting to login', 'error');
                        // Use router instead of window.location to prevent page refresh
                        if (isMounted.current) {
                            router.push('/auth?reason=session_expired');
                        }
                        return {success: false, error: 'Session expired'};
                    }

                    // Get the response data and check if we're authenticated
                    const sessionData = await sessionResponse.json();
                    if (!sessionData.authenticated) {
                        log('Session is invalid, redirecting to login', 'error');
                        if (isMounted.current) {
                            router.push('/auth?reason=session_expired');
                        }
                        return {success: false, error: 'Session expired'};
                    }

                    // Retry the original request
                    try {
                        const retryResponse = await fetch('/api/businesses', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache',
                                'Expires': '0'
                            },
                            credentials: 'include', // Include cookies for authentication
                            body: JSON.stringify({
                                name: businessName.trim(),
                                type: businessType,
                                email: businessType === "invite" ? businessEmail.trim() : undefined,
                                authPending: businessType === "google" // Flag to indicate auth will follow
                            }),
                        });

                        const retryData = await retryResponse.json();
                        
                        if (retryResponse.ok && retryData.success) {
                            return {success: true, businessId: retryData.businessId};
                        }
                    } catch (retryError) {
                        log(`Retry attempt failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`, 'error');
                    }

                    return {success: false, error: 'Session error. Please try again.'};
                }

                return {success: false, error: data.error || 'Failed to add business'};
            }

            log(`Business added successfully: ${data.businessId}`, 'info');

            // For invite type, we're done
            if (businessType === "invite") {
                // Reset form and close modal
                resetForm();

                // Refresh the business list with a delay
                setTimeout(() => {
                    log('Refreshing businesses list after adding new business', 'info');
                    fetchBusinesses(true);
                }, 1000);

                // Show a success message
                alert('Business added successfully!');
            }

            return {success: true, businessId: data.businessId};
        } catch (err) {
            log(`Error adding business: ${err instanceof Error ? err.message : String(err)}`, 'error');
            return {success: false, error: err instanceof Error ? err.message : 'Unknown error'};
        } finally {
            // Always reset loading state if we're not going to auth step
            if (businessType !== "google" || !isGoogleAuthStep) {
                setIsLoading(false);
            }
        }
    }

    // Helper to reset the form
    const resetForm = () => {
        setBusinessName("");
        setBusinessEmail("");
        setGoogleEmail("");
        setGooglePassword("");
        setAuthError("");
        setIsGoogleAuthStep(false);
        setIsAddBusinessModalOpen(false);
    }

    // Memoize filtered business counts to prevent recalculation on each render
    const businessCounts = useMemo(() => {
        if (!businesses || businesses.length === 0) {
            return {
                noncompliantCount: 0,
                compliantCount: 0,
                activeCount: 0,
                completionRate: 0
            };
        }
        
        const noncompliantCount = businesses.filter(b => b.status === 'noncompliant').length;
        const compliantCount = businesses.filter(b => b.status === 'compliant').length;
        const activeCount = businesses.filter(b => b.status === 'active').length;
        const completionRate = businesses.length > 0
            ? Math.round((compliantCount / businesses.length) * 100)
            : 0;

        return {
            noncompliantCount,
            compliantCount,
            activeCount,
            completionRate
        };
    }, [businesses]);

    // Memoize event handlers
    const handleRowClick = useCallback((business: Business) => {
        setSelectedBusiness(business);
        setIsModalOpen(true);

        // If the business has a browser instance, activate it
        if (business.browserInstance) {
            log(`Activating browser instance ${business.browserInstance} for business ${business.id}`, 'info');

            // Tell the server to use this instance for subsequent operations
            fetch('/api/compliance/activate-browser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    businessId: business.id,
                    instanceId: business.browserInstance
                }),
            }).catch(err => {
                log(`Error activating browser instance: ${err instanceof Error ? err.message : String(err)}`, 'error');
            });
        }
    }, []);

    const handleClose = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleAddBusinessClick = useCallback(() => {
        // Check subscription limits first
        if (locationLimit !== null && businesses.length >= locationLimit) {
            // Find the next tier that would allow more businesses
            const nextTier = subscriptionPlans.find(plan =>
                plan.businessLimit > locationLimit
            );

            setLimitError({
                currentSubscription: userSubscription,
                requiredSubscription: nextTier?.id || 'enterprise',
                currentCount: businesses.length,
                maxAllowed: locationLimit
            });

            setIsUpgradeModalOpen(true);
            return;
        }

        setIsAddBusinessModalOpen(true);
    }, [businesses.length, locationLimit, userSubscription]);

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            {/* Header - moved to Header component */}
            <div className="hidden">
                {/* Keep this div to prevent layout shifts during refactoring */}
            </div>

            <div className="w-full max-w-[1200px] h-auto min-h-[600px] mx-auto bg-white rounded-2xl shadow-sm">
                <div className="p-8">
                    {/* Stats Section */}
                    <div className="flex items-center justify-between mb-10 min-w-[600px]">
                        {/* Logo */}
                        <div className="flex-shrink-0">
                            <Image
                                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Group%20362-rvrX4OJ5ZH5Nbk05Br5thefaRKSJih.png"
                                alt="Brand Logo"
                                width={220}
                                height={120}
                                priority={true}
                                quality={80}
                            />
                        </div>

                        {/* Stats */}
                        <div className="text-center">
                            <div className="text-7xl font-bold text-black mb-[14px]">
                                {businessCounts.noncompliantCount}
                            </div>
                            <div className="flex justify-center">
                                <StatusIndicator status="noncompliant"/>
                            </div>
                            <div className="text-sm text-gray-600 mt-[26px]">Noncompliant</div>
                        </div>

                        <div className="text-center">
                            <div className="text-7xl font-bold text-black mb-[14px]">
                                {businessCounts.compliantCount}
                            </div>
                            <div className="flex justify-center">
                                <StatusIndicator status="compliant"/>
                            </div>
                            <div className="text-sm text-gray-600 mt-[26px]">Compliant</div>
                        </div>

                        <div className="text-center">
                            <div className="text-7xl font-bold text-black mb-[14px]">
                                {businessCounts.activeCount}
                            </div>
                            <div className="flex justify-center">
                                <StatusIndicator status="active"/>
                            </div>
                            <div className="text-sm text-gray-600 mt-[26px]">Active</div>
                        </div>

                        {/* Progress Circle */}
                        <div className="flex-shrink-0">
                            <div className="flex flex-col items-center">
                                <ProgressCircle value={businessCounts.completionRate}/>
                                <span className="text-sm mt-2rem text-gray-600">Completion Rate</span>
                            </div>
                        </div>
                    </div>

                    {/* Removed subscription limit status section */}

                    {/* Table */}
                    <div className="rounded-lg overflow-hidden border border-gray-100">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-black hover:bg-black">
                                    <TableHead className="text-white font-normal text-base py-4">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-full bg-white"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddBusinessClick();
                                                }}
                                            >
                                                <PlusIcon className="h-4 w-4 text-black"/>
                                            </Button>
                                            <span>Account Name</span>
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="text-white font-normal text-base text-right py-4">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center py-8">
                                            <div className="flex justify-center">
                                                <div
                                                    className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : error || businesses.length === 0 ? (
                                    <TableRow className="cursor-pointer hover:bg-gray-50"
                                              onClick={handleAddBusinessClick}>
                                        <TableCell colSpan={2} className="text-center py-10">
                                            <div className="flex flex-col items-center">
                                                <div
                                                    className="bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] p-[2px] rounded-lg mb-4">
                                                    <div className="bg-white px-8 py-4 rounded-lg">
                                                        <h3 className="text-xl font-semibold bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] inline-block text-transparent bg-clip-text">
                                                            Let's get started!
                                                        </h3>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-center space-x-1">
                                                    <span
                                                        className="text-gray-500 font-medium">Add your first business</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    // Render businesses with a virtualized approach for better performance
                                    businesses.slice(0, 10).map((business) => (
                                        <TableRow
                                            key={business.id}
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => handleRowClick(business)}
                                        >
                                            <TableCell className="text-black py-4 flex items-center">
                                                {/* Show alert icon for businesses that need re-authentication */}
                                                {business.authStatus === 'failed' && (
                                                    <div className="mr-2 text-amber-500"
                                                         title="Authentication needs attention">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                             strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path
                                                                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                            <line x1="12" y1="9" x2="12" y2="13"></line>
                                                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                                        </svg>
                                                    </div>
                                                )}
                                                {business.name}
                                            </TableCell>
                                            <TableCell className="text-right py-4 pr-8">
                                                <div className="flex justify-end">
                                                    <StatusIndicator status={business.status}/>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                    // Show "Load more" button if there are more than 10 businesses
                                )}
                                {businesses.length > 10 && (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center py-4">
                                            <Button
                                                variant="ghost"
                                                className="text-sm text-gray-500 hover:text-black"
                                                onClick={() => log("Load more businesses", 'info')}
                                            >
                                                Load more ({businesses.length - 10} remaining)
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* No floating add button - using the one in the table header instead */}

            {/* Business Profile Modal */}
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                setIsModalOpen(open);
                // Only refresh businesses list when modal is closed if changes were made
                // This prevents unnecessary refreshes when just viewing the modal
                if (!open && selectedBusiness) {
                    // Use the timestamp approach to determine if we need to refresh
                    const modalOpenTimestamp = selectedBusiness._modalOpenTime || 0;
                    const modalDuration = Date.now() - modalOpenTimestamp;
                    
                    // Only refresh if the modal was open for at least 5 seconds
                    // This is a good heuristic for determining if changes were made
                    // Short interactions (< 5 seconds) are likely just viewing, not editing
                    if (modalDuration > 5000) {
                        log("Modal was open for " + Math.round(modalDuration/1000) + " seconds - refreshing data", 'info');
                        // Add a small delay before refreshing to ensure modal is fully closed
                        setTimeout(() => {
                            // Only refresh if no other modal is open
                            if (typeof window !== 'undefined' && !window.__modalOpen) {
                                fetchBusinesses(true);
                            }
                        }, 500);
                    } else {
                        log("Short modal interaction - skipping refresh", 'info');
                    }
                }
            }}>
                <DialogContent className="p-0 max-w-[1200px] w-[95vw] h-[95vh] max-h-[92vh] overflow-hidden"
                               aria-describedby="profile-modal-description">
                    <DialogTitle className="sr-only">Business Profile Details</DialogTitle>
                    <div id="profile-modal-description" className="sr-only">
                        Business profile details and management interface
                    </div>
                    <BusinessProfileModal 
                        business={selectedBusiness ? {
                            ...selectedBusiness,
                            _modalOpenTime: Date.now() // Add timestamp when modal was opened
                        } : null} 
                        onClose={() => {
                            log("Business profile modal closed via explicit close button", 'info');
                            // Just close the modal - refresh will be handled by onOpenChange if needed
                            handleClose();
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* Add Business Modal - Enhanced Version with Google Auth */}
            <Dialog
                open={isAddBusinessModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        // Reset form when closing modal
                        resetForm();
                    }
                    setIsAddBusinessModalOpen(open);
                }}
            >
                <DialogContent className="max-w-sm p-6 max-h-[90vh]" aria-describedby="add-business-description">
                    {!isGoogleAuthStep ? (
                        // Step 1: Business Info
                        <>
                            <DialogTitle className="text-xl font-semibold mb-2">Add Business</DialogTitle>
                            <DialogDescription id="add-business-description">
                                Add a new business to manage through Social Genius.
                            </DialogDescription>

                            <div className="py-4 space-y-4">
                                {/* Option Selection */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium">Select an option:</h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {/* Google Business Profile Option */}
                                        <div
                                            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${businessType === 'google' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'}`}
                                            onClick={() => setBusinessType('google')}
                                        >
                                            <div
                                                className="h-4 w-4 rounded-full border border-gray-300 flex items-center justify-center flex-shrink-0">
                                                {businessType === 'google' && (
                                                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-1">
                                                <Building2Icon className="h-5 w-5 text-blue-600"/>
                                                <div>
                                                    <div>Google Business Profile</div>
                                                    <div className="text-xs text-gray-500">Connect an existing Google
                                                        Business Profile
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Invitation Option */}
                                        <div
                                            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${businessType === 'invite' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 hover:bg-blue-50/50'}`}
                                            onClick={() => setBusinessType('invite')}
                                        >
                                            <div
                                                className="h-4 w-4 rounded-full border border-gray-300 flex items-center justify-center flex-shrink-0">
                                                {businessType === 'invite' && (
                                                    <div className="h-2 w-2 rounded-full bg-blue-600"></div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-1">
                                                <MailIcon className="h-5 w-5 text-blue-600"/>
                                                <div>
                                                    <div>Send Invitation Email</div>
                                                    <div className="text-xs text-gray-500">Invite a client to add their
                                                        business
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Business Name Field */}
                                <div className="space-y-2">
                                    <label htmlFor="business-name" className="block text-sm font-medium">
                                        Business Name
                                    </label>
                                    <input
                                        id="business-name"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                        placeholder="Enter business name"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddBusiness();
                                            }
                                        }}
                                    />
                                </div>

                                {/* Email Field - Only shown for invitation option */}
                                {businessType === 'invite' && (
                                    <div className="space-y-2">
                                        <label htmlFor="business-email" className="block text-sm font-medium">
                                            Business Email
                                        </label>
                                        <input
                                            id="business-email"
                                            type="email"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                            value={businessEmail}
                                            onChange={(e) => setBusinessEmail(e.target.value)}
                                            placeholder="Enter contact email"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddBusiness();
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAddBusinessModalOpen(false)}
                                    className="px-4 py-2"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddBusiness}
                                    disabled={!businessName || (businessType === 'invite' && !businessEmail)}
                                    className="px-4 py-2 bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white hover:opacity-90"
                                >
                                    {businessType === 'google' ? 'Next' : 'Add Business'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        // Step 2: Google Authentication (only for google business type)
                        <>
                            <DialogTitle className="text-xl font-semibold mb-2">
                                <div className="flex items-center justify-center">
                                    <img
                                        src="https://www.svgrepo.com/show/303108/google-icon-logo.svg"
                                        alt="Google"
                                        width={28}
                                        height={28}
                                        className="mr-3"
                                    />
                                    <span className="text-[#5F6368] font-normal">Sign in with Google</span>
                                </div>
                            </DialogTitle>

                            {/* Error display */}
                            {authError && (
                                <div
                                    className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                                    {authError}
                                </div>
                            )}

                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleAddBusiness();
                            }} className="py-4 space-y-4">
                                {/* Google login container styling */}
                                <div
                                    className="flex flex-col items-center justify-center w-full max-w-md mx-auto p-6 border border-gray-300 rounded-md shadow-sm">
                                    <div className="w-full text-center mb-4">
                                        <h1 className="text-2xl font-normal mb-2 text-[#202124]">Sign in</h1>
                                        <p className="text-sm text-[#5F6368] mb-6">to continue to Google Business
                                            Profile</p>
                                    </div>

                                    {/* Google Email Field */}
                                    <div className="w-full space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="google-email"
                                                   className="block text-sm font-medium text-[#5F6368]">
                                                Email or phone
                                            </label>
                                            {googleEmail && !googleEmail.includes('@') && (
                                                <span className="text-red-500 text-xs">Invalid email format</span>
                                            )}
                                        </div>
                                        <input
                                            id="google-email"
                                            type="email"
                                            className={`w-full px-3 py-3 border rounded-md focus:outline-none focus:ring-1 ${
                                                googleEmail && !googleEmail.includes('@')
                                                    ? 'border-red-300 focus-visible:ring-red-400'
                                                    : 'border-gray-300 focus-visible:ring-blue-500 focus:border-blue-500'
                                            }`}
                                            value={googleEmail}
                                            onChange={(e) => setGoogleEmail(e.target.value)}
                                            placeholder="youremail@gmail.com"
                                            disabled={isAuthSubmitting}
                                            autoComplete="email"
                                            required
                                            minLength={5} // Basic validation
                                            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$" // Email pattern
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    document.getElementById('google-password')?.focus();
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Google Password Field */}
                                    <div className="w-full space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="google-password"
                                                   className="block text-sm font-medium text-[#5F6368]">
                                                Password
                                            </label>
                                            {googlePassword && googlePassword.length < 6 && (
                                                <span className="text-red-500 text-xs">Min. 6 characters</span>
                                            )}
                                        </div>
                                        <input
                                            id="google-password"
                                            type="password"
                                            className={`w-full px-3 py-3 border rounded-md focus:outline-none focus:ring-1 ${
                                                googlePassword && googlePassword.length < 6
                                                    ? 'border-red-300 focus-visible:ring-red-400'
                                                    : 'border-gray-300 focus-visible:ring-blue-500 focus:border-blue-500'
                                            }`}
                                            value={googlePassword}
                                            onChange={(e) => setGooglePassword(e.target.value)}
                                            placeholder="••••••••"
                                            disabled={isAuthSubmitting}
                                            required
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (googleEmail && googlePassword && googlePassword.length >= 6) {
                                                        handleAddBusiness();
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="w-full flex justify-between mt-6 mb-4">
                                        <button
                                            type="button"
                                            className="text-sm text-[#1a73e8] hover:text-blue-700 hover:underline font-medium"
                                            onClick={() => setIsGoogleAuthStep(false)}
                                            disabled={isAuthSubmitting}
                                        >
                                            Back
                                        </button>
                                        <a href="#"
                                           className="text-sm text-[#1a73e8] hover:text-blue-700 hover:underline font-medium">
                                            Forgot password?
                                        </a>
                                    </div>

                                    <div className="w-full mt-3">
                                        {isAuthSubmitting ? (
                                            <button
                                                type="button"
                                                className="w-full py-2.5 px-4 bg-[#1a73e8] text-white font-medium rounded-md focus:outline-none flex items-center justify-center"
                                                disabled={true}
                                            >
                                                <div
                                                    className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                                                Signing in...
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                className="w-full py-2.5 px-4 bg-[#1a73e8] text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none"
                                                disabled={isAuthSubmitting || !googleEmail || !googlePassword ||
                                                    (googleEmail && !googleEmail.includes('@')) ||
                                                    (googlePassword && googlePassword.length < 6)}
                                            >
                                                Sign in
                                            </button>
                                        )}
                                    </div>

                                    <div className="text-xs text-gray-500 mt-4 text-center">
                                        <p>Not your computer? Use Guest mode to sign in privately.</p>
                                        <a href="#" className="text-[#1a73e8] hover:text-blue-700 hover:underline">Learn
                                            more</a>
                                    </div>
                                </div>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Authentication Screenshots Modal */}
            <Dialog open={isScreenshotModalOpen} onOpenChange={setIsScreenshotModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogTitle>Authentication Screenshots</DialogTitle>
                    <div className="mb-4">
                        <p className="text-sm text-gray-500">
                            These screenshots show the Google authentication process steps for debugging purposes.
                        </p>
                    </div>
                    
                    <div className="w-full overflow-auto p-4">
                        {selectedScreenshot ? (
                            <div className="flex flex-col items-center">
                                <h3 className="text-lg font-semibold mb-2">
                                    {Object.entries(authScreenshots || {}).find(([key, value]) => value === selectedScreenshot)?.[0] || 'Screenshot'}
                                </h3>
                                <img 
                                    src={selectedScreenshot} 
                                    alt="Authentication step" 
                                    className="max-w-full border rounded"
                                />
                                <Button 
                                    onClick={() => setSelectedScreenshot(null)}
                                    className="mt-4"
                                >
                                    Back to list
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {authScreenshots && Object.entries(authScreenshots).map(([key, value]) => (
                                    <div 
                                        key={key} 
                                        className="border rounded p-2 cursor-pointer hover:bg-gray-50"
                                        onClick={() => setSelectedScreenshot(value)}
                                    >
                                        <p className="text-sm font-medium mb-1 truncate">{key}</p>
                                        <img 
                                            src={value} 
                                            alt={key} 
                                            className="w-full h-32 object-cover rounded border"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end mt-4">
                        <Button onClick={() => setIsScreenshotModalOpen(false)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Subscription Upgrade Modal */}
            {limitError && (
                <SubscriptionUpgradeModal
                    isOpen={isUpgradeModalOpen}
                    onClose={handleCloseUpgradeModal}
                    currentPlan={limitError.currentSubscription}
                    requiredPlan={limitError.requiredSubscription}
                    limitType="locations"
                    currentCount={limitError.currentCount}
                />
            )}
        </div>
    )
}

export default BusinessProfileDashboard