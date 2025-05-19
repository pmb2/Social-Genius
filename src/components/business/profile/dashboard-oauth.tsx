/**
 * Business Profile Dashboard with OAuth support
 * 
 * This is an enhanced version of the dashboard component that supports 
 * both OAuth and legacy browser automation for Google Business Profile.
 */

"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog" // Added Dialog components
import { ProgressCircle } from "@/components/ui/progress-circle"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { useAuth } from "@/lib/auth"
import { subscriptionPlans } from "@/services/subscription/plans"
import { FeatureFlag, FeatureFlagService } from "@/services/feature-flag-service"
import { AddBusinessModalOAuth } from "./add-business-modal-oauth"
// Original modal for non-OAuth businesses
import { AddBusinessModal } from "./add-business-modal"
// Import specific icons instead of the whole library to reduce bundle size
import PlusIcon from "lucide-react/dist/esm/icons/plus"
import Building2Icon from "lucide-react/dist/esm/icons/building-2"
import Image from "next/image"
import dynamic from "next/dynamic"

// Dynamically import heavy components to reduce initial load time
const BusinessProfileModal = dynamic(() => import("./modal"), {
    loading: () => <div className="animate-pulse bg-gray-200 w-full h-full rounded-xl"></div>,
    ssr: false
})

// Define Business type
type Business = {
    id: number;
    businessId: string;
    name: string;
    status: string;
    createdAt: string;
    authStatus?: 'logged_in' | 'pending' | 'failed';
    browserInstance?: string;
    authMethod?: 'browser' | 'oauth';
    _modalOpenTime?: number; // Track when modal was opened to detect changes
}

interface BusinessProfileDashboardProps {
    onBusinessCountChange?: (count: number) => void;
}

export function BusinessProfileDashboardOAuth({ onBusinessCountChange }: BusinessProfileDashboardProps) {
    // Router for client-side navigation without full page reloads
    const router = useRouter();
    
    // State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAddBusinessModalOpen, setIsAddBusinessModalOpen] = useState(false);
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
    const [limitError, setLimitError] = useState<{
        currentSubscription: string;
        requiredSubscription: string;
        currentCount: number;
        maxAllowed: number;
    } | null>(null);
    
    // Track if component is mounted to prevent operations after unmount
    const isMounted = useRef(true);

    // Auth and subscription data
    const { user } = useAuth();
    const userSubscription = user?.subscription || 'basic';
    const currentPlan = subscriptionPlans.find(plan => plan.id === userSubscription) || subscriptionPlans[0];
    const locationLimit = currentPlan.businessLimit;
    
    // Feature flags
    const featureFlags = FeatureFlagService.getInstance();
    const useOAuth = featureFlags.isEnabled(FeatureFlag.GoogleAuthWithOAuth, user?.id);

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
    }, [router, onBusinessCountChange]);

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
        if (business.browserInstance && business.authMethod !== 'oauth') {
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

    const handleBusinessAdded = useCallback(() => {
        // Refresh businesses list after adding a new one
        fetchBusinesses(true); // Skip cache to ensure we get the newest data
    }, [fetchBusinesses]);

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
                                    // Render businesses
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
                                                {/* Show OAuth badge if using OAuth */}
                                                {business.authMethod === 'oauth' && (
                                                    <div className="mr-2 text-blue-500"
                                                         title="Connected with Google OAuth">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                                                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                             strokeWidth="2" strokeLinecap="round"
                                                             strokeLinejoin="round">
                                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                                            <path d="M9 12l2 2 4-4"></path>
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
                if (!open && selectedBusiness) {
                    // Use the timestamp approach to determine if we need to refresh
                    const modalOpenTimestamp = selectedBusiness._modalOpenTime || 0;
                    const modalDuration = Date.now() - modalOpenTimestamp;
                    
                    // Only refresh if the modal was open for at least 5 seconds
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
                <DialogContent className="p-0 max-w-[1200px] w-[95vw] h-[95vh] max-h-[92vh] overflow-hidden">
                    <BusinessProfileModal 
                        business={selectedBusiness ? {
                            ...selectedBusiness,
                            _modalOpenTime: Date.now() // Add timestamp when modal was opened
                        } : null} 
                        onClose={handleClose}
                    />
                </DialogContent>
            </Dialog>

            {/* Add Business Modal - Use OAuth or legacy based on feature flag */}
            {useOAuth ? (
                <AddBusinessModalOAuth 
                    isOpen={isAddBusinessModalOpen}
                    onClose={() => setIsAddBusinessModalOpen(false)}
                    onSuccess={handleBusinessAdded}
                    userId={user?.id}
                />
            ) : (
                <AddBusinessModal 
                    isOpen={isAddBusinessModalOpen}
                    onClose={() => setIsAddBusinessModalOpen(false)}
                    onSuccess={handleBusinessAdded}
                />
            )}
        </div>
    )
}