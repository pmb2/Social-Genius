'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/lib/toast-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  // We're removing the problematic visibility change handler
  // that was trying to force garbage collection and likely
  // causing page refreshes and modal issues
  useEffect(() => {
    // This effect is intentionally left empty to avoid
    // timing and memory management issues in the previous code
    
    // The browser will handle its own memory management
    // without needing explicit garbage collection calls
    // which can cause unintended side effects
  }, []);
  
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}