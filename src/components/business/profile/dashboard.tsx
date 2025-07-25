"use client"

import {useState, useEffect, useMemo, useCallback, useRef, Suspense} from "react"
import {useRouter} from "next/navigation"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Dialog, DialogContent, DialogTitle} from "@/components/ui/dialog"

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
import SignInModal from "@/components/SignInModal";
import ProfileSettingsTile from "@/components/user/profile-settings-tile";

// Dynamically import heavy components to reduce initial load time
const BusinessProfileModal = dynamic(() => import("./modal"), {
    loading: () => <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>,
    ssr: false
})

// Will be populated from API
const initialBusinessAccounts: Business[] = []

// Define Business type - ADD socialAccounts array
type Business = {
    id: string;
    businessId: string;
    name: string;
    status: string;
    createdAt: string;
    authStatus?: 'logged_in' | 'pending' | 'failed';
    browserInstance?: string;
    _modalOpenTime?: number; // Track when modal was opened to detect changes
    socialAccounts?: SocialAccount[];
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
    email?: string;
    description?: string;
}

// Define SocialAccount type (should match the interface in postgres-service.ts)
interface SocialAccount {
    id: string;
    user_id: string; // Changed to user_id to match DB
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
    const [businesses, setBusinesses] = useState<Business[]>(initialBusinessAccounts)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [modalError, setModalError] = useState<string | null>(null) // New state for modal-specific errors
    const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
    const [isProfileSettingsModalOpen, setIsProfileSettingsModalOpen] = useState(false);
    const [profileSettingsTab, setProfileSettingsTab] = useState<string | undefined>(undefined);
    const [profileSettingsHighlight, setProfileSettingsHighlight] = useState<string | undefined>(undefined);
    const [limitError, setLimitError] = useState<{
        currentSubscription: string;
        requiredSubscription: string;
        currentCount: number;
        maxAllowed: number;
    } | null>(null);
    const [isSubmittingBusiness, setIsSubmittingBusiness] = useState(false); // For the business creation process

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
        log('[BUSINESS] Fetching businesses...');
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
                const businessesFromCache = cachedData.businesses || [];
                // Only log when debug is enabled
                if (businessesFromCache?.length > 0) {
                    log(`Using cached businesses data (${businessesFromCache.length} items)`, 'info');
                }

                if (businessesFromCache) {

                    // Sort businesses with priority:
                    // 1. Failed auth status first (need attention)
                    // 2. Then by creation date (newest first)
                    const sortedBusinesses = [...businessesFromCache].sort((a, b) => {
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
                log(`Client-side document.cookie: ${document.cookie}`, 'info');
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
            log(`[BUSINESS] Fetched ${data.businesses?.length || 0} businesses from API.`, 'info');
            console.log('[BUSINESS] Raw data from API:', data);

            // Save to session storage cache
            if (typeof window !== 'undefined') {
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        businesses: data.businesses, // Store the businesses array directly
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    log('Error writing to cache: ' + String(e), 'warn');
                }
            }

            const businesses = data.businesses || [];
            console.log('[BUSINESS] Businesses from API:', businesses);
            if (businesses) {
                // Sort businesses with priority:
                // 1. Failed auth status first (need attention)
                // 2. Then by creation date (newest first)
                const sortedBusinesses = [...businesses].sort((a, b) => {
                    // First sort by auth status - failed auth businesses first
                    if (a.authStatus === 'failed' && b.authStatus !== 'failed') return -1;
                    if (a.authStatus !== 'failed' && b.authStatus === 'failed') return 1;

                    // Then sort by creation date (newest first)
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });

                setBusinesses(sortedBusinesses);
                console.log('[BUSINESS] Businesses state updated:', sortedBusinesses);
                
                // Notify parent component about the business count
                if (onBusinessCountChange) {
                    onBusinessCountChange(sortedBusinesses.length);
                }
            } else {
                setBusinesses([]);
                console.log('[BUSINESS] Businesses state updated to empty array.');
                
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

    // Initial data fetch on component mount
    useEffect(() => {
        fetchBusinesses();
    }, [fetchBusinesses]);

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

    const handleSkip = async (businessName: string) => {
        log(`Attempting to skip social login for business: ${businessName}`, 'info');
        if (!user || !user.id) {
            log('User ID not found or user not authenticated, cannot create business.', 'error');
            setModalError('User not authenticated. Please log in.');
            return;
        }
        log(`User ID: ${user.id}`, 'info');

        setIsSubmittingBusiness(true); // Use this state for loading
        setModalError(null); // Clear previous errors

        try {
            log('Making API call to /api/businesses/create', 'info');
            const response = await fetch('/api/businesses/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: businessName, userId: user.id }), // Pass userId
            });
            const data = await response.json();
            log(`API response for business creation: ${JSON.stringify(data)}`, 'info');
            if (!response.ok) {
                log(`API error: ${data.error || response.statusText}`, 'error');
                throw new Error(data.error || 'Failed to create business');
            }
                        log(`Business "${businessName}" created successfully.`, 'info');
            
            // Explicitly remove cache and then await the fetch
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('user_businesses_cache');
                log('Cache cleared for user_businesses_cache.', 'info');
            }

            // Add a small delay to allow the session to update
            await new Promise(resolve => setTimeout(resolve, 1000));

            await fetchBusinesses(true); // Refresh the list of businesses, ensuring it completes

            setIsAddBusinessModalOpen(false); // Close the modal only after refresh
        } catch (err) {
            log(`Error creating business: ${err instanceof Error ? err.message : String(err)}`, 'error');
            setModalError(err instanceof Error ? err.message : 'Failed to create business.');
        } finally {
            setIsSubmittingBusiness(false);
        }
    };

    // Helper to reset the form
    const resetForm = () => {
        setModalError(null);
        setIsSubmittingBusiness(false);
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
    const handleRowClick = useCallback((business: Business, tab?: string, highlight?: string) => {
        setSelectedBusiness({
            ...business,
            _modalOpenTime: Date.now() // Set timestamp when modal is opened
        });
        setIsModalOpen(true);

        // Update URL with businessId, tab, and highlight for direct linking
        const url = new URL(window.location.href);
        url.searchParams.set('businessId', business.businessId);
        if (tab) {
            url.searchParams.set('tab', tab);
        }
        if (highlight) {
            url.searchParams.set('highlight', highlight);
        }
        
        router.replace(url.pathname + url.search, undefined, { shallow: true });
    }, [router]);

    const handleClose = useCallback(() => {
        setIsModalOpen(false);
        console.log("BusinessProfileModal closed. isModalOpen: ", false);
    }, []);

    const handleOpenProfileSettings = useCallback((tab: string, highlight?: string) => {
        setProfileSettingsTab(tab);
        setProfileSettingsHighlight(highlight);
        setIsProfileSettingsModalOpen(true);
        console.log("ProfileSettingsTile modal opened. Tab: ", tab, ", Highlight: ", highlight);
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
                                style={{ width: 'auto', height: 'auto' }}
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
                                            <span className="text-sm text-gray-500 ml-2">({businesses.length}/{locationLimit === -1 ? 'Unlimited' : locationLimit})</span>
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="text-white font-normal text-base text-right py-4 pr-4">Status</TableHead>
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
                <DialogContent className="p-0 max-w-[2500px] w-[90vw] h-[90vh] max-h-[92vh] overflow-hidden"
                               aria-describedby="profile-modal-description">
                    <DialogTitle className="sr-only">Business Profile Details</DialogTitle>
                    <div id="profile-modal-description" className="sr-only">
                        Business profile details and management interface
                    </div>
                    <BusinessProfileModal 
                                business={selectedBusiness} 
                                onClose={() => {
                                    log("Business profile modal closed via explicit close button", 'info');
                                    fetchBusinesses(true); // Force refresh on close
                                    handleClose();
                                }}
                                onOpenSettings={(tab, highlight) => {
                                    handleClose(); // Close the BusinessProfileModal
                                    setTimeout(() => {
                                        handleOpenProfileSettings(tab, highlight);
                                    }, 100); // Add a small delay
                                }}
                                currentUser={user}
                            />
                </DialogContent>
            </Dialog>

            <SignInModal 
                isOpen={isAddBusinessModalOpen} 
                onClose={() => setIsAddBusinessModalOpen(false)} 
                onLogin={(platform, email, password, businessName) => {
                    window.location.href = `/api/auth/${platform}/login?mode=link&userId=${user.id}&businessName=${encodeURIComponent(businessName)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
                }}
                onSkip={handleSkip}
                mode="add"
            />

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

            {/* Profile Settings Modal */}
            <Dialog open={isProfileSettingsModalOpen} onOpenChange={setIsProfileSettingsModalOpen}>
                <DialogContent className="max-w-md p-0 overflow-visible">
                    <DialogTitle className="sr-only">Profile Settings</DialogTitle>
                    <ProfileSettingsTile
                        isStandalone={true}
                        onClose={() => setIsProfileSettingsModalOpen(false)}
                        initialTab={profileSettingsTab || "profile"}
                        initialHighlight={profileSettingsHighlight}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default BusinessProfileDashboard
