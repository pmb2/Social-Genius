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
        
        // Force redirect after 5 seconds if still loading (increased from 2 seconds)
        // This helps prevent premature redirection that might interrupt other processes
        const redirectTimer = setTimeout(() => {
            // If after 5 seconds we still don't know auth state, make a sensible default
            // But only do this if we're still mounted and still loading
            if (loading) {
                console.log("Still loading after timeout, redirecting to auth");
                router.replace('/auth');
            }
        }, 5000); // Extended to 5 seconds
        
        return () => {
            clearTimeout(redirectTimer);
            console.log("Home page redirect timer cleared");
        };
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

