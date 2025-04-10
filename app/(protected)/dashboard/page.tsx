'use client';

import { BusinessProfileDashboard } from "@/components/business-profile-dashboard"
import { FeedbackButton } from "@/components/feedback-button"
import { Header } from "@/components/header"
import ProfileSettingsTile from "@/components/profile-settings-tile"
import NotificationSettingsTile from "@/components/notification-settings-tile"
import { SubscriptionSettingsTile } from "@/components/subscription/subscription-settings-tile"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    // Use our custom auth context
    const { user, loading, checkSession } = useAuth();
    
    // Keep track of when we last logged
    const [lastLogTime, setLastLogTime] = useState<number>(0);
    
    useEffect(() => {
        if (loading) {
            setIsLoading(true);
        } else {
            setIsLoading(false);
            
            // Redirect to login if not authenticated
            if (!user) {
                console.log("Dashboard: No user found in context, redirecting to auth");
                router.push('/auth');
            } else {
                // Only log every 3 minutes (180000ms) to reduce spam
                const now = Date.now();
                const LOG_INTERVAL = 180000; // 3 minutes
                
                if (now - lastLogTime > LOG_INTERVAL) {
                    const isDev = process.env.NODE_ENV === 'development';
                    if (isDev) {
                        const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
                        console.log(`[${timestamp}] Dashboard: User authenticated: ${user.email}`);
                    }
                    setLastLogTime(now);
                }
            }
        }
    }, [user, loading, router, checkSession, lastLogTime]);

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
                    <SubscriptionSettingsTile />
                </div>
            </div>
            
            <div className="fixed bottom-6 right-6">
                <FeedbackButton/>
            </div>
        </div>
    )
}