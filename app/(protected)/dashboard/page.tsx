'use client';

import { BusinessProfileDashboard } from "@/components/business/profile/dashboard"
import { FeedbackButton } from "@/components/ui/feedback/button"
import { Header } from "@/components/layout/header"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

export default function DashboardPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [businessCount, setBusinessCount] = useState(0);

    const { user, loading, checkSession } = useAuth();

    useEffect(() => {
        const debugEnabled = process.env.NODE_ENV === 'development' && process.env.DEBUG_DASHBOARD === 'true';
        
        if (debugEnabled) {
            console.log("[DASHBOARD] Auth state - loading:", loading, "user:", user ? "exists" : "null");
        }
        
        if (loading) {
            setIsLoading(true);
            return;
        }
        
        if (user) {
            setIsLoading(false);
            return;
        }
        
        const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
            
        if (isModalOpen) {
            setIsLoading(false);
            return;
        }
        
        const timer = setTimeout(async () => {
            const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                
            if (isModalOpen) {
                setIsLoading(false);
                return;
            }
            
            if (debugEnabled) {
                console.log("[DASHBOARD] Running delayed session check");
            }
            
            try {
                const hasSession = await checkSession();
                
                if (hasSession && user) {
                    setIsLoading(false);
                } else {
                    const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                        
                    if (!isModalOpen) {
                        router.push('/auth?reason=session_expired');
                    }
                }
            } catch (error) {
                if (debugEnabled) {
                    console.error("[DASHBOARD] Session check error");
                }
                
                const isModalOpen = typeof window !== 'undefined' && window.__modalOpen === true;
                    
                if (!isModalOpen) {
                    router.push('/auth?reason=session_error');
                }
                
                setIsLoading(false);
            }
        }, 1500);
        
        return () => clearTimeout(timer);
    }, [user, loading, checkSession, router]);

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
