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
        console.log("[DASHBOARD] Component mounted or auth state changed");
        console.log("[DASHBOARD] Auth state - loading:", loading, "user:", user ? "exists (ID: " + user.id + ")" : "null");
        
        // Log cookies in the dashboard component for debugging
        if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';').map(c => c.trim());
            console.log("[DASHBOARD] Current cookies:", cookies);
            const sessionCookie = cookies.find(c => c.startsWith('session='));
            const sessionIdCookie = cookies.find(c => c.startsWith('sessionId='));
            
            console.log("[DASHBOARD] Session cookie:", 
                      sessionCookie ? `present (${sessionCookie.split('=')[1]?.substring(0, 8)}...)` : 'missing');
            console.log("[DASHBOARD] SessionId cookie:", 
                      sessionIdCookie ? `present (${sessionIdCookie.split('=')[1]?.substring(0, 8)}...)` : 'missing');
        }
        
        if (loading) {
            console.log("[DASHBOARD] Still loading auth state, showing loader");
            setIsLoading(true);
            return; // Don't do anything else while loading
        }
        
        // If we already have a user, show the dashboard immediately
        if (user) {
            console.log("[DASHBOARD] User authenticated ID:", user.id, "Email:", user.email);
            console.log("[DASHBOARD] User session active, showing dashboard");
            setIsLoading(false);
            return;
        }
        
        // If no user is found but cookies exist, try to re-verify the session
        const hasCookies = typeof document !== 'undefined' && (
            document.cookie.includes('session=') || document.cookie.includes('sessionId=')
        );
        
        console.log("[DASHBOARD] No user in context but cookies present:", hasCookies);
        
        // If no user is found, perform a session check after a delay
        // to ensure cookies have been properly processed
        const timer = setTimeout(async () => {
            console.log("[DASHBOARD] Running delayed session check");
            
            try {
                // Try to verify the session one more time before redirecting
                console.log("[DASHBOARD] Re-checking session...");
                const hasSession = await checkSession();
                console.log("[DASHBOARD] Session check result:", hasSession ? "Valid session" : "No valid session");
                console.log("[DASHBOARD] User state after check:", user ? "User present" : "No user");
                
                if (hasSession && user) {
                    console.log("[DASHBOARD] Session verified on recheck, showing dashboard");
                    setIsLoading(false);
                } else {
                    console.log("[DASHBOARD] No valid session found on recheck, redirecting to auth");
                    // Use window.location for hard redirect
                    window.location.href = '/auth?reason=no_valid_session_on_recheck';
                }
            } catch (error) {
                console.error("[DASHBOARD] Error rechecking session:", error);
                // If session check fails, redirect to login
                window.location.href = '/auth?reason=session_check_error';
            } finally {
                setIsLoading(false);
            }
        }, 2000); // Even longer delay to ensure cookies are properly processed
        
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