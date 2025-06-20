"use client"

import {useState, useEffect, useMemo, useCallback, useRef, Suspense} from "react"
import {useRouter} from "next/navigation"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {ProgressCircle} from "@/components/ui/progress-circle"
import {StatusIndicator} from "@/components/ui/status-indicator"
import {SubscriptionUpgradeModal} from "@/components/subscription/subscription-upgrade-modal"
import {useAuth} from "@/lib/auth/context" // Directly import useAuth from context
import {subscriptionPlans} from "@/services/subscription/plans"
// REMOVED: import {encryptPassword} from "@/utils/password-encryption" // No longer needed without GBP auth
// Import specific icons instead of the whole library to reduce bundle size
import PlusIcon from "lucide-react/dist/esm/icons/plus"
// REMOVED: import MailIcon from "lucide-react/dist/esm/icons/mail" // No longer needed without invite option
// REMOVED: import Building2Icon from "lucide-react/dist/esm/icons/building-2" // No longer needed without GBP option
import Image from "next/image"
import dynamic from "next/dynamic"
import Link from "next/link"; // ADDED: For the X account connect button
import { FaXTwitter } from "react-icons/fa6"; // ADDED: For the X icon

// Dynamically import heavy components to reduce initial load time
const BusinessProfileModal = dynamic(() => import("./modal"), {
    loading: () => <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>,
    ssr: false
})

// Will be populated from API
const initialBusinessAccounts: Business[] = []

// Define Business type - ADD socialAccounts array
type Business = {
    id: number;
    businessId: string;
    name: string;
    status: string;
    createdAt: string;
    authStatus?: 'logged_in' | 'pending' | 'failed';
    browserInstance?: string;
    _modalOpenTime?: number; // Track when modal was opened to detect changes
    socialAccounts?: SocialAccount[]; // ADDED THIS LINE
}

// Define SocialAccount type (should match the interface in postgres-service.ts)
interface SocialAccount {
    id: number;
    user_id: number; // Changed to user_id to match DB
    business_id?: string | null; // Changed to business_id to match DB
    platform: string;
    platform_user_id: string; // Changed to platform_user_id to match DB
    username?: string | null;
    profile_picture_url?: string | null; // Changed to profile_picture_url to match DB
    access_token: string;
    refresh_token?: string | null;
    expires_at?: Date | null; // Changed to expires_at to match DB
    created_at?: Date;
    updated_at?: Date;
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
    // REMOVED: const [businessEmail, setBusinessEmail] = useState("")
    // REMOVED: const [businessType, setBusinessType] = useState("google") // "google" or "invite"
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

    // REMOVED ALL GOOGLE AUTH RELATED STATES:
    // const [googleEmail, setGoogleEmail] = useState("")
    // const [googlePassword, setGooglePassword] = useState("")
    // const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
    // const [authError, setAuthError] = useState("")
    // const [isGoogleAuthStep, setIsGoogleAuthStep] = useState(false)
    // const [autoLoginAttempted, setAutoLoginAttempted] = useState(false)
    // const [authScreenshots, setAuthScreenshots] = useState<Record<string, string> | null>(null)
    // const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false)
    // const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null)
    
    // NEW STATE FOR THE ADD BUSINESS FLOW (already added in previous instructions, keeping)
    const [currentBusinessId, setCurrentBusinessId] = useState<string | null>(null); // Stores the ID of the newly created business
    const [isConnectingSocial, setIsConnectingSocial] = useState(false); // Controls the "Connect Social" step in the modal
    const [isSubmittingBusiness, setIsSubmittingBusiness] = useState(false); // For the initial business name submission

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
            // MODIFIED: Add includeSocialAccounts=true to the API call
            const response = await fetch(`/api/businesses?t=${timestamp}&includeSocialAccounts=true`, {
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
    }, [onBusinessCountChange, router]); // Added router to dependencies

    // REMOVED: tryAutoLoginForAllBusinesses and its useEffect
    // The entire block from line 100 to line 230 (or wherever it ends in your file) should be removed.
    // This includes the `tryAutoLoginForAllBusinesses` function definition and the `useEffect` that calls it.

    // ADDED: New useEffect to handle successful social account connection redirect
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const twitterConnected = urlParams.get('twitter_connected');
            
            if (twitterConnected === 'success') {
                alert('X (Twitter) account connected successfully!');
                // Clear the URL parameter
                router.replace(window.location.pathname, undefined, { shallow: true });
                // Refresh businesses to show the newly connected account
                fetchBusinesses(true);
            }
        }
    }, [router, fetchBusinesses]); // Added fetchBusinesses to dependencies

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

    // MODIFIED handleAddBusiness function
    const handleAddBusiness = async () => {
        try {
            // Check subscription limits first
            if (locationLimit !== null && businesses.length >= locationLimit) {
                const nextTier = subscriptionPlans.find(plan => plan.businessLimit > locationLimit);
                setLimitError({
                    currentSubscription: userSubscription,
                    requiredSubscription: nextTier?.id || 'enterprise',
                    currentCount: businesses.length,
                    maxAllowed: locationLimit
                });
                setIsUpgradeModalOpen(true);
                return;
            }

            // Step 1: Add Business Name
            if (!isConnectingSocial) { // If not yet in the social connection step
                log(`Starting to add new business: "${businessName}"`, 'info');

                if (!businessName.trim()) {
                    alert('Please enter a business name');
                    return;
                }

                setIsSubmittingBusiness(true); // Set loading state for business creation
                setError(null); // Clear any previous errors

                try {
                    const response = await fetch('/api/businesses', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                            'Expires': '0',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            name: businessName.trim(),
                            type: 'general', // Default to 'general' type for now
                            // REMOVED: authPending: false // No auth pending for general business creation
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        if (response.status === 403 && data.limitReached) {
                            setLimitError({
                                currentSubscription: data.currentSubscription || userSubscription,
                                requiredSubscription: data.requiredSubscription || 'enterprise',
                                currentCount: data.currentCount || businesses.length,
                                maxAllowed: data.maxAllowed || locationLimit
                            });
                            setIsUpgradeModalOpen(true);
                            setIsAddBusinessModalOpen(false);
                            return;
                        }
                        throw new Error(data.error || 'Failed to add business');
                    }

                    log(`Business added successfully: ${data.businessId}`, 'info');
                    setCurrentBusinessId(data.businessId); // Store the newly created business ID
                    setIsConnectingSocial(true); // Move to the social connection step
                    setError(null); // Clear any errors
                } catch (err) {
                    log(`Error adding business: ${err instanceof Error ? err.message : String(err)}`, 'error');
                    setError(err instanceof Error ? err.message : 'Unknown error adding business');
                } finally {
                    setIsSubmittingBusiness(false); // Clear loading state
                }
            } else {
                // This block would be for handling social connection submission if it were a form
                // For OAuth, we'll just redirect, so this part might not be directly used for submission.
                // It serves as a placeholder if you add more social connection methods later.
                log('Attempted to handle social connection submission (not applicable for direct OAuth redirect)', 'info');
            }
        } catch (err) {
            log(`Fatal error in handleAddBusiness: ${err instanceof Error ? err.message : String(err)}`, 'error');
            setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        }
    };

    // Helper to reset the form
    const resetForm = () => {
        setBusinessName("");
        // REMOVED: setBusinessEmail("");
        // REMOVED: setGoogleEmail("");
        // REMOVED: setGooglePassword("");
        // REMOVED: setAuthError("");
        // REMOVED: setIsGoogleAuthStep(false);
        setCurrentBusinessId(null); // Clear the business ID
        setIsConnectingSocial(false); // Reset to initial step
        setIsSubmittingBusiness(false); // Reset submitting state
        // REMOVED: setIsAddBusinessModalOpen(false); // This is handled by onOpenChange
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
                                    {/* ADDED NEW TABLE HEADERS FOR SOCIAL ACCOUNTS */}
                                    <TableHead className="text-white font-normal text-base text-center py-4">Social Accounts</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8"> {/* Adjusted colspan */}
                                            <div className="flex justify-center">
                                                <div
                                                    className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : error || businesses.length === 0 ? (
                                    <TableRow className="cursor-pointer hover:bg-gray-50"
                                              onClick={handleAddBusinessClick}>
                                        <TableCell colSpan={3} className="text-center py-10"> {/* Adjusted colspan */}
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
                                            {/* NEW TABLE CELL FOR SOCIAL ACCOUNTS */}
                                            <TableCell className="text-center py-4">
                                                <div className="flex justify-center space-x-2">
                                                    {business.socialAccounts && business.socialAccounts.map(account => (
                                                        <span key={account.id} className="text-gray-600" title={account.username || account.platform}>
                                                            {account.platform === 'twitter' && <FaXTwitter className="h-5 w-5 text-black" />}
                                                            {/* Add other social icons here */}
                                                        </span>
                                                    ))}
                                                    {(!business.socialAccounts || business.socialAccounts.length === 0) && (
                                                        <span className="text-gray-400 text-sm">None</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                {businesses.length > 10 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4"> {/* Adjusted colspan */}
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

            {/* Add Business Modal - REVAMPED */}
            <Dialog
                open={isAddBusinessModalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        resetForm();
                    }
                    setIsAddBusinessModalOpen(open);
                }}
            >
                <DialogContent className="max-w-sm p-6 max-h-[90vh]" aria-describedby="add-business-description">
                    {!isConnectingSocial ? (
                        // Step 1: Business Info (Name only)
                        <>
                            <DialogTitle className="text-xl font-semibold mb-2">Add New Business</DialogTitle>
                            <DialogDescription id="add-business-description">
                                Enter the name of the business you want to manage.
                            </DialogDescription>

                            <div className="py-4 space-y-4">
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
                                        placeholder="e.g., My Awesome Business"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddBusiness();
                                            }
                                        }}
                                        disabled={isSubmittingBusiness}
                                    />
                                </div>
                            </div>

                            {error && ( // Display error for business creation
                                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAddBusinessModalOpen(false)}
                                    className="px-4 py-2"
                                    disabled={isSubmittingBusiness}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleAddBusiness}
                                    disabled={!businessName.trim() || isSubmittingBusiness}
                                    className="px-4 py-2 bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-white hover:opacity-90"
                                >
                                    {isSubmittingBusiness ? 'Adding Business...' : 'Add Business'}
                                </Button>
                            </div>
                        </>
                    ) : (
                        // Step 2: Connect Social Accounts
                        <>
                            <DialogTitle className="text-xl font-semibold mb-2">
                                Connect Social Accounts
                            </DialogTitle>
                            <DialogDescription>
                                Your business "{businessName}" has been created. Now, connect your social media accounts.
                            </DialogDescription>

                            <div className="py-4 space-y-4">
                                <p className="text-sm text-gray-600">
                                    Connect your X (Twitter) account to start managing it.
                                </p>
                                <div className="flex justify-center">
                                    <Link
                                        // Construct the OAuth URL with the new business ID
                                        href={`/api/auth/signin/twitter?type=add_account&businessId=${currentBusinessId}`}
                                        className="flex items-center justify-center px-6 py-3 rounded-full bg-black hover:bg-gray-800 transition-colors duration-200 focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        onClick={() => setIsAddBusinessModalOpen(false)} // Close modal when redirecting
                                    >
                                        <FaXTwitter className="w-5 h-5 text-white mr-2"/>
                                        <span className="text-white font-medium">Connect X Account</span>
                                    </Link>
                                </div>
                                {/* You can add more social media options here later */}
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsAddBusinessModalOpen(false)}
                                    className="px-4 py-2"
                                >
                                    Done
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* REMOVED: Authentication Screenshots Modal - this was for Google Business Profile */}
            {/* <Dialog open={isScreenshotModalOpen} onOpenChange={setIsScreenshotModalOpen}> ... </Dialog> */}

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
