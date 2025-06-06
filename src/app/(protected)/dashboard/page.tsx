'use client';

// Import the OAuth version of the dashboard by default
import { BusinessProfileDashboardOAuth } from "@/components/business/profile/dashboard-oauth";
// Keep legacy dashboard for potential fallback
import { BusinessProfileDashboard } from "@/components/business/profile/dashboard";
import { FeedbackButton } from "@/components/ui/feedback/button";
import { Header } from "@/components/layout/header";
// Only import components that are actually used
// import NotificationSettingsTile from "@/components/notifications/settings-tile";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

export default function DashboardPage() {
    // Hooks must be at the top level of the component
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [businessCount, setBusinessCount] = useState(0);
    const [useOAuthDashboard, setUseOAuthDashboard] = useState(true);

    // Use our custom auth context
    const { user, loading, checkSession } = useAuth();
    
    // Use a callback for setting business count to avoid unnecessary rerenders
    const handleBusinessCountChange = useCallback((count) => {
        setBusinessCount(count);
    }, []);
    
    // Feature flag effect hook - should run only once on mount
    useEffect(() => {
        let isMounted = true;
        
        // This is a placeholder - in the real application, you'd check the feature flag service
        const checkFeatureFlag = async () => {
            try {
                // In production, this would be a call to your feature flag service or API
                // For now, we'll just default to true (use OAuth)
                if (isMounted) {
                    setUseOAuthDashboard(true);
                }
            } catch (error) {
                console.error("Error checking feature flag:", error);
                // Fall back to legacy dashboard on error
                if (isMounted) {
                    setUseOAuthDashboard(false);
                }
            }
        };
        
        checkFeatureFlag();
        
        // Cleanup function to prevent state updates after unmounting
        return () => {
            isMounted = false;
        };
    }, []);
    
    // Auth effect hook - handle auth state changes
    useEffect(() => {
        // Use a variable to track component mount status to prevent memory leaks
        let isMounted = true;
        
        // Only log critical errors or when explicitly enabled with DEBUG_DASHBOARD=true
        const debugEnabled = process.env.NODE_ENV === 'development' && process.env.DEBUG_DASHBOARD === 'true';
        
        if (debugEnabled) {
            console.log("[DASHBOARD] Auth state - loading:", loading, "user:", user ? "exists" : "null");
        }
        
        if (loading) {
            if (isMounted) {
                setIsLoading(true);
            }
            return; // Don't do anything else while loading
        }
        
        // If we already have a user, show the dashboard immediately
        if (user) {
            if (isMounted) {
                setIsLoading(false);
            }
            return;
        }
        
        // Only check session if absolutely necessary
        // and only if no dialogs are open to prevent disruption
        const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
            
        if (isModalOpen) {
            // Don't disrupt open dialogs with auth checks - assume valid for now
            if (isMounted) {
                setIsLoading(false);
            }
            return;
        }
        
        // If no user is found, perform a session check after a delay
        // to ensure cookies have been properly processed
        const timer = setTimeout(async () => {
            // Skip if component has unmounted
            if (!isMounted) return;
            
            // Check again if any dialogs have been opened in the meantime
            const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                
            if (isModalOpen) {
                // Don't disrupt open dialogs with auth checks
                if (isMounted) {
                    setIsLoading(false);
                }
                return;
            }
            
            // Only log if debug is enabled
            if (debugEnabled) {
                console.log("[DASHBOARD] Running delayed session check");
            }
            
            try {
                // Try to verify the session one more time before redirecting
                const hasSession = await checkSession();
                
                // Skip further processing if component unmounted during async operation
                if (!isMounted) return;
                
                if (hasSession && user) {
                    setIsLoading(false);
                } else {
                    // Only redirect if no dialogs are open
                    const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                        
                    if (!isModalOpen) {
                        // Redirect to auth page without reloading the whole window
                        router.push('/auth?reason=session_expired');
                    } else {
                        // Just mark as loaded but don't redirect yet
                        setIsLoading(false);
                    }
                }
            } catch (error) {
                // Skip error handling if component unmounted
                if (!isMounted) return;
                
                if (debugEnabled) {
                    console.error("[DASHBOARD] Session check error", error);
                }
                
                // Only redirect if no dialogs are open
                const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                    
                if (!isModalOpen) {
                    // Redirect to auth page without reloading the whole window
                    router.push('/auth?reason=session_error');
                }
                
                setIsLoading(false);
            }
        }, 1500); // Increased delay to improve responsiveness and reduce frequency
        
        // Cleanup function to prevent memory leaks and state updates after unmounting
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [user, loading, checkSession, router]);
    
    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Main content
    return (
        <div className="min-w-[800px] scrollbar-hide overflow-auto">
            <Header businessCount={businessCount} />
            {useOAuthDashboard ? (
                <BusinessProfileDashboardOAuth onBusinessCountChange={handleBusinessCountChange} />
            ) : (
                <BusinessProfileDashboard onBusinessCountChange={handleBusinessCountChange} />
            )}
            
            <div className="fixed bottom-6 right-6">
                <FeedbackButton />
            </div>
        </div>
    );
}