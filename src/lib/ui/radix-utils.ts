'use client';

/**
 * Utility to handle Radix UI specific behavior and fix issues
 */

// Track if any dialog is currently animating
let isDialogAnimating = false;

// Keep track of whether any dialog is open
let activeDialogCount = 0;

// Function to ensure Radix animation lifecycle completes properly
export function handleRadixAnimationComplete(callback: () => void) {
  // Mark as animating
  isDialogAnimating = true;
  
  // Wait for animation to complete (Radix animations are typically 200-300ms)
  setTimeout(() => {
    // Mark animation as complete
    isDialogAnimating = false;
    
    // Execute callback
    callback();
    
    // Force a refresh after animation completes
    if (typeof document !== 'undefined') {
      // Force a style update to ensure cleanup is applied
      void document.body.offsetHeight;
      
      // Dispatch a custom event that our components can listen for
      const event = new CustomEvent('radixAnimationComplete');
      document.dispatchEvent(event);
    }
  }, 350); // A bit longer than the animation to ensure it's complete
}

// Register a dialog as open
export function registerDialog() {
  activeDialogCount++;
  
  // Update global state
  if (typeof window !== 'undefined') {
    window.__modalOpen = activeDialogCount > 0;
  }
  
  return () => {
    // Unregister when unmounted
    activeDialogCount = Math.max(0, activeDialogCount - 1);
    
    // Update global state
    if (typeof window !== 'undefined') {
      window.__modalOpen = activeDialogCount > 0;
    }
  };
}

// Check if any dialog is currently animating
export function isAnyDialogAnimating() {
  return isDialogAnimating;
}

// Reset all animation and dialog state (emergency cleanup)
export function resetRadixState() {
  isDialogAnimating = false;
  // Don't reset activeDialogCount here to avoid race conditions
  
  if (typeof window !== 'undefined') {
    // Don't reset window.__modalOpen here - depend on actual DOM state instead
  }
  
  // Find and cleanup any stuck dialogs
  if (typeof document !== 'undefined') {
    // Look for data-state="open" but with no content OR marked as hidden
    document.querySelectorAll('[data-state="open"]').forEach(el => {
      // Only apply to elements that are actually HIDDEN but marked open
      const isDialogDisplay = window.getComputedStyle(el).display;
      const isDialogVisible = window.getComputedStyle(el).visibility;
      const isDialogHidden = el.getAttribute('aria-hidden') === 'true';
      
      // Only clean up truly "stuck" dialogs - those that are hidden but marked as open
      if ((isDialogDisplay === 'none' || isDialogVisible === 'hidden' || isDialogHidden) &&
          el.children.length === 0) {
        // This is clearly a stuck dialog that should be cleaned up
        el.setAttribute('data-state', 'closed');
        
        // Force style refresh
        void el.offsetHeight;
        
        // Remove it after animation time
        setTimeout(() => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        }, 300);
      }
    });
  }
}