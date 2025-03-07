'use client';

import { BusinessProfileDashboard } from "@/components/business-profile-dashboard"
import { FeedbackButton } from "@/components/feedback-button"
import { Header } from "@/components/header"
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
        <div className="min-w-[800px]">
            <Header />
            <BusinessProfileDashboard/>
            <div className="fixed bottom-6 right-6">
                <FeedbackButton/>
            </div>
        </div>
    )
}