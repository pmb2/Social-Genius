'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    
    useEffect(() => {
        console.log("Home page useEffect running, loading state:", loading);
        
        // Immediately redirect if not loading
        if (!loading) {
            if (user) {
                console.log("User authenticated, redirecting to dashboard");
                router.replace('/dashboard');
            } else {
                console.log("User not authenticated, redirecting to auth page");
                router.replace('/auth');
            }
            return; // Skip the timer if we already redirected
        }
        
        // Force redirect after 2 seconds if still loading
        const redirectTimer = setTimeout(() => {
            // If after 2 seconds we still don't know auth state, make a sensible default
            if (loading) {
                console.log("Still loading after timeout, redirecting to auth");
                router.replace('/auth');
            }
        }, 2000);
        
        return () => clearTimeout(redirectTimer);
    }, [user, loading, router]);

    // Display a loading state during the redirect
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-center">Welcome to Social Genius</h1>
                <p className="text-center text-gray-600 mt-2">Loading your experience...</p>
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
    );
}

