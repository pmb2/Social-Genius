'use client';

import { BusinessProfileDashboard } from "@/components/business-profile-dashboard"
import { FeedbackButton } from "@/components/feedback-button"
import { Header } from "@/components/header"
import ProfileSettingsTile from "@/components/profile-settings-tile"
import NotificationSettingsTile from "@/components/notification-settings-tile"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

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
        
        // If no user is found but cookies exist, try to re-verify the session
        const hasCookies = typeof document !== 'undefined' && (
            document.cookie.includes('session=') || document.cookie.includes('sessionId=')
        );
        
        // If no user is found, perform a session check after a delay
        // to ensure cookies have been properly processed
        const timer = setTimeout(async () => {
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
                    // Redirect to auth page without reloading the whole window
                    router.push('/auth?reason=session_expired');
                }
            } catch (error) {
                if (debugEnabled) {
                    console.error("[DASHBOARD] Session check error");
                }
                // Redirect to auth page without reloading the whole window
                router.push('/auth?reason=session_error');
            } finally {
                setIsLoading(false);
            }
        }, 1000); // Reduced delay to improve responsiveness
        
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
            <Header />
            <BusinessProfileDashboard/>
            
            {/* Settings tiles */}
            <div className="max-w-[1200px] mx-auto my-8 px-8">
                <h2 className="text-xl font-semibold mb-4 bg-gradient-to-r from-[#FFAB1A] via-[#FF1681] to-[#0080FF] text-transparent bg-clip-text inline-block">Quick Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <ProfileSettingsTile />
                    <NotificationSettingsTile />
                </div>
            </div>
            
            <div className="fixed bottom-6 right-6">
                <FeedbackButton/>
            </div>
        </div>
    )
}