'use client';

import { BusinessProfileDashboard } from "@/components/business-profile-dashboard"
import { FeedbackButton } from "@/components/feedback-button"
import { Header } from "@/components/header"
import NotificationSettingsTile from "@/components/notification-settings-tile"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [businessCount, setBusinessCount] = useState(0);

    // Use our custom auth context
    const { user, loading, checkSession } = useAuth();
    
    useEffect(() => {
        // Removed excessive logging for clarity
        // Only log critical errors or when explicitly enabled with DEBUG_DASHBOARD=true
        const debugEnabled = process.env.NODE_ENV === 'development' && process.env.DEBUG_DASHBOARD === 'true';
        
        if (debugEnabled) {
            console.log("[DASHBOARD] Auth state - loading:", loading, "user:", user ? "exists" : "null");
        }
        
        if (loading) {
            // Set loading state without logging
            setIsLoading(true);
            return; // Don't do anything else while loading
        }
        
        // If we already have a user, show the dashboard immediately
        if (user) {
            setIsLoading(false);
            return;
        }
        
        // Only check session if absolutely necessary
        // and only if no dialogs are open to prevent disruption
        const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
            
        if (isModalOpen) {
            // Don't disrupt open dialogs with auth checks - assume valid for now
            setIsLoading(false);
            return;
        }
        
        // If no user is found but cookies exist, try to re-verify the session
        const hasCookies = typeof document !== 'undefined' && (
            document.cookie.includes('session=') || document.cookie.includes('sessionId=')
        );
        
        // If no user is found, perform a session check after a delay
        // to ensure cookies have been properly processed
        const timer = setTimeout(async () => {
            // Check again if any dialogs have been opened in the meantime
            const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                
            if (isModalOpen) {
                // Don't disrupt open dialogs with auth checks
                setIsLoading(false);
                return;
            }
            
            // Only log if debug is enabled
            if (debugEnabled) {
                console.log("[DASHBOARD] Running delayed session check");
            }
            
            try {
                // Try to verify the session one more time before redirecting
                const hasSession = await checkSession();
                
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
                if (debugEnabled) {
                    console.error("[DASHBOARD] Session check error");
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
        
        return () => clearTimeout(timer);
    }, [user, loading, checkSession]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-w-[800px] scrollbar-hide overflow-auto">
            <Header businessCount={businessCount} />
            <BusinessProfileDashboard onBusinessCountChange={setBusinessCount} />
            
            <div className="fixed bottom-6 right-6">
                <FeedbackButton/>
            </div>
        </div>
    )
}