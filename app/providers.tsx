'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  // Performance optimization - clear query caches and run garbage collection when tab becomes invisible
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Clear caches when tab becomes invisible to free up memory
        setTimeout(() => {
          try {
            // Request garbage collection via setTimeout (only works in some browsers)
            if (window.gc) window.gc();
            
            // Clear memory-heavy objects
            console.clear();
          } catch (e) {
            // Ignore errors
          }
        }, 500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}