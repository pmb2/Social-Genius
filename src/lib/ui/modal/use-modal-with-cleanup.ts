'use client';

import { useState, useCallback } from 'react';

/**
 * Custom hook to manage modal state with proper cleanup
 * to avoid stale event handlers and interaction issues
 */
export function useModalWithCleanup(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  
  // Open the modal
  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);
  
  // Close the modal with cleanup
  const closeModal = useCallback(() => {
    setIsOpen(false);
    
    // Cleanup any lingering event handlers
    setTimeout(() => {
      // Simulate a click outside to ensure all handlers are cleaned up
      const event = new Event('mousedown', { bubbles: true });
      document.dispatchEvent(event);
    }, 50);
  }, []);
  
  // Handler for the onOpenChange prop of Dialog
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      setIsOpen(true);
    } else {
      closeModal();
    }
  }, [closeModal]);
  
  return {
    isOpen,
    setIsOpen: handleOpenChange,
    openModal,
    closeModal,
    handleOpenChange
  };
}