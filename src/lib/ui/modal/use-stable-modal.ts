'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * A stable hook for managing modal state with protections against
 * race conditions and auto-closing
 */
export function useStableModal(initialState = false) {
  // Main modal state
  const [isOpen, setIsOpen] = useState(initialState);
  
  // Protection against debounce issues
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Track if modal was recently opened
  const [recentlyOpened, setRecentlyOpened] = useState(false);
  
  // Handle opening the modal with protections
  const open = useCallback(() => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setIsOpen(true);
    setRecentlyOpened(true);
    
    // Clear processing flag after delay
    setTimeout(() => {
      setIsProcessing(false);
    }, 300);
    
    // Clear recently opened flag after delay
    setTimeout(() => {
      setRecentlyOpened(false);
    }, 1000);
  }, [isProcessing]);
  
  // Handle closing the modal with protections
  const close = useCallback(() => {
    // Allow closing even if recently opened - fixes issues with stuck modals
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    // First close the modal
    setIsOpen(false);
    
    // Immediately clean up modal-related DOM state
    if (typeof document !== 'undefined') {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      
      // Force remove any "inert" attributes that might block interaction
      document.querySelectorAll('[inert]').forEach(el => {
        el.removeAttribute('inert');
      });
      
      // Force redraw to apply changes
      void document.body.offsetHeight;
    }
    
    // Clear processing flag after delay
    setTimeout(() => {
      setIsProcessing(false);
    }, 300);
  }, [isProcessing]);
  
  // Handle the onOpenChange event from Radix UI Dialog
  const onOpenChange = useCallback((open: boolean) => {
    if (open) {
      // Opening request
      if (!isOpen && !isProcessing) {
        setIsOpen(true);
        setRecentlyOpened(true);
        
        // Clear recently opened flag after delay
        setTimeout(() => {
          setRecentlyOpened(false);
        }, 1000);
      }
    } else {
      // Closing request - prevent if recently opened
      if (!recentlyOpened && !isProcessing) {
        setIsOpen(false);
      }
    }
  }, [isOpen, isProcessing, recentlyOpened]);
  
  return {
    isOpen,
    open,
    close,
    onOpenChange
  };
}