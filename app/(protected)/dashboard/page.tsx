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
    const { user, loading } = useAuth();
    
    useEffect(() => {
        if (loading) {
            setIsLoading(true);
        } else {
            setIsLoading(false);
            
            // Redirect to login if not authenticated
            if (!user) {
                router.push('/auth');
            }
        }
    }, [user, loading, router]);

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