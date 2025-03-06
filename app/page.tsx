'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    
    useEffect(() => {
        if (!loading) {
            if (user) {
                // If logged in, redirect to dashboard
                router.push('/dashboard');
            } else {
                // If not logged in, redirect to auth page
                router.push('/auth');
            }
        }
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

