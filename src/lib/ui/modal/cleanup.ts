'use client';

import { resetRadixState, handleRadixAnimationComplete } from '@/lib/ui/radix-utils';

/**
 * Modal cleanup utility to fix interaction issues
 * by directly manipulating the DOM when needed
 */

// Function to remove hidden elements that might be causing interaction problems
export function cleanupAfterModalClose() {
  if (typeof document === 'undefined') return;
  
  // Immediately reset Radix state without waiting for animation
  resetRadixState();
  
  // Do immediate cleanup first for critical elements
  if (typeof document !== 'undefined') {
    // Immediately clear body styles that might be causing issues
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    
    // Remove any inert attributes that might be blocking interactions
    document.querySelectorAll('[inert]').forEach(el => {
      el.removeAttribute('inert');
    });
  }
  
  // Then do the complete cleanup after animation completes
  handleRadixAnimationComplete(() => {
    // 1. Remove any stuck overlay elements
    const possibleOverlays = document.querySelectorAll('[role="dialog"]');
    possibleOverlays.forEach(overlay => {
      if (overlay instanceof HTMLElement && 
          (!overlay.hasAttribute('data-state') || overlay.getAttribute('data-state') === 'closed')) {
        // This is likely a "stuck" overlay
        overlay.style.display = 'none';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }, 100);
      }
    });
    
    // 2. Remove any invisible elements with higher z-index
    const highZElements = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        if (el instanceof HTMLElement) {
          const computed = window.getComputedStyle(el);
          const zIndex = parseInt(computed.zIndex, 10);
          
          // Element with high z-index that might block interactions
          return !isNaN(zIndex) && zIndex > 10;
        }
        return false;
      });
    
    highZElements.forEach(el => {
      if (el instanceof HTMLElement) {
        // Check if this is a dialog-related element that should be cleaned up
        if (el.getAttribute('role') === 'dialog' || 
            el.getAttribute('aria-modal') === 'true' ||
            el.classList.contains('dialog-overlay')) {
          el.style.display = 'none';
          el.style.pointerEvents = 'none';
          el.style.zIndex = '-1';
        }
      }
    });
    
    // 3. Reset pointer-events on body and html
    document.documentElement.style.pointerEvents = '';
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    
    // 4. Force event propagation to clear any stuck handlers
    const events = ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      document.body.dispatchEvent(event);
    });
    
    // 5. Reset common focus trap elements
    const focusTraps = document.querySelectorAll('[data-focus-guard], [data-focus-lock-disabled]');
    focusTraps.forEach(trap => {
      if (trap instanceof HTMLElement) {
        trap.style.display = 'none';
        trap.style.pointerEvents = 'none';
        setTimeout(() => {
          if (trap.parentNode) {
            trap.parentNode.removeChild(trap);
          }
        }, 100);
      }
    });
    
    // 6. Reset any aria-hidden attributes on main content
    document.querySelectorAll('[aria-hidden="true"]').forEach(el => {
      // Only reset if it's not a legitimate hidden element
      const role = el.getAttribute('role');
      if (role !== 'dialog' && role !== 'alertdialog') {
        el.removeAttribute('aria-hidden');
      }
    });
    
    // 7. Reset all inert attributes which might prevent interaction
    document.querySelectorAll('[inert]').forEach(el => {
      el.removeAttribute('inert');
    });
    
    // 8. Only clean up abandoned Radix Portal elements (no longer needed)
    // IMPORTANT: Do NOT remove portals with active dialogs!
    document.querySelectorAll('[data-radix-portal]').forEach(portal => {
      const hasOpenDialog = portal.querySelector('[data-state="open"]');
      // Also check for subscription-plans-modal content to avoid cleaning up our active modal
      const isSubscriptionModal = portal.textContent?.includes('Subscription Plans');
      
      // Only remove portals that definitely have no open dialog AND aren't our subscription modal
      if (!hasOpenDialog && !isSubscriptionModal) {
        // This is likely an abandoned portal - remove it
        if (portal.parentNode) {
          portal.setAttribute('aria-hidden', 'true');
          portal.style.display = 'none';
          
          // Wait before actually removing to avoid disrupting active UI
          setTimeout(() => {
            if (portal.parentNode) {
              portal.parentNode.removeChild(portal);
            }
          }, 1000); // Longer delay to ensure all other operations complete
        }
      }
    });
    
    // 9. Force a style recalculation to flush changes
    void document.body.offsetHeight;
    
    console.log('[Modal Cleanup] Performed DOM cleanup after modal close');
  });
}

// Function to prepare for modal opening
export function prepareForModalOpen() {
  if (typeof document === 'undefined') return;
  
  // Ensure no stuck inert attributes
  document.querySelectorAll('[inert]').forEach(el => {
    el.removeAttribute('inert');
  });
  
  // Force a reflow to apply changes
  void document.body.offsetHeight;
}