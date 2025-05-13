'use client';

import React, { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth/context';
import { ToastProvider } from '@/lib/providers/toast';
import { setupModalOpenHandler, cleanupModalEffects } from '@/lib/ui/modal/handler';
import { cleanupAfterModalClose } from '@/lib/ui/modal/cleanup';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Initialize window.__modalOpen if it doesn't exist
    if (window.__modalOpen === undefined) {
      window.__modalOpen = false;
    }
    
    // Initialize window.__modalHandlersInitialized if it doesn't exist
    if (window.__modalHandlersInitialized === undefined) {
      window.__modalHandlersInitialized = false;
    }
    
    // Setup emergency modal cleanup via Alt+Shift+C keyboard shortcut
    const handleEmergencyCleanup = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key === 'C') {
        console.log('🧹 Emergency modal cleanup triggered');
        cleanupAfterModalClose();
        
        // Show feedback to user
        const feedbackDiv = document.createElement('div');
        feedbackDiv.style.position = 'fixed';
        feedbackDiv.style.bottom = '20px';
        feedbackDiv.style.left = '20px';
        feedbackDiv.style.background = 'rgba(0,0,0,0.8)';
        feedbackDiv.style.color = 'white';
        feedbackDiv.style.padding = '10px 15px';
        feedbackDiv.style.borderRadius = '4px';
        feedbackDiv.style.zIndex = '10000';
        feedbackDiv.textContent = 'Modal cleanup triggered!';
        
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => {
          if (feedbackDiv.parentNode) {
            feedbackDiv.parentNode.removeChild(feedbackDiv);
          }
        }, 3000);
      }
    };
    
    window.addEventListener('keydown', handleEmergencyCleanup);
    
    // Perform an immediate cleanup when the app loads to remove any stuck modals
    cleanupAfterModalClose();
    
    // Prevent automatic page refresh when dialogs are open
    const preventRefreshWhenModalsOpen = (event: BeforeUnloadEvent) => {
      if (window.__modalOpen) {
        // Prevent the refresh/navigation when modals are open
        event.preventDefault();
        // Chrome requires returnValue to be set
        event.returnValue = '';
        return '';
      }
      
      // Allow the navigation/refresh to proceed if no modals are open
      return undefined;
    };
    
    // Add a beforeunload event listener to detect and prevent reloads when modals are open
    window.addEventListener('beforeunload', preventRefreshWhenModalsOpen);
    
    // Set up our improved modal handler
    setupModalOpenHandler();
    
    // Detect and prevent refresh attempts
    const originalReload = history.go;
    history.go = function(delta: number) {
      if (window.__modalOpen) {
        console.warn('Page navigation blocked while modals are open');
        return;
      }
      
      return originalReload.call(this, delta);
    };
    
    return () => {
      window.removeEventListener('beforeunload', preventRefreshWhenModalsOpen);
      window.removeEventListener('keydown', handleEmergencyCleanup);
      cleanupModalEffects();
      cleanupAfterModalClose();
      
      // Restore original history.go
      if (history.go !== originalReload) {
        history.go = originalReload;
      }
    };
  }, []);
  
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}