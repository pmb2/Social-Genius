'use client';

// Modal state management to prevent page refresh issues and maintain interactivity
let modalOpenCount = 0;
let documentBodyStyleBackup: string | null = null;

export function setupModalOpenHandler() {
  if (typeof window === 'undefined') return;

  if (!window.__modalHandlersInitialized) {
    // Create a MutationObserver to detect modal state changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if we're observing attribute changes on elements with 'data-state' attribute
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'data-state' && 
            mutation.target instanceof HTMLElement) {
          
          const element = mutation.target;
          
          if (element.getAttribute('data-state') === 'open') {
            handleModalOpen();
          } else if (element.getAttribute('data-state') === 'closed') {
            handleModalClose();
          }
        }
      }
    });

    // Start observing the document body for changes
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-state']
    });

    // Mark that we've initialized the handlers
    window.__modalHandlersInitialized = true;
  }
}

// Handle modal opening - called each time a modal opens
function handleModalOpen() {
  modalOpenCount++;
  window.__modalOpen = true;
  
  // If this is the first modal being opened, save the current body style
  if (modalOpenCount === 1) {
    documentBodyStyleBackup = document.body.style.cssText;
    // Add a class to indicate modals are open
    document.body.classList.add('modal-open');
  }
}

// Handle modal closing - called each time a modal closes
function handleModalClose() {
  modalOpenCount = Math.max(0, modalOpenCount - 1);
  window.__modalOpen = modalOpenCount > 0;
  
  // If all modals are closed, restore body styles
  if (modalOpenCount === 0) {
    // Small delay before restoring body state to ensure all React effects complete
    setTimeout(() => {
      // Only do this if still no modals open
      if (modalOpenCount === 0) {
        // Restore original body style
        if (documentBodyStyleBackup !== null) {
          document.body.style.cssText = documentBodyStyleBackup;
        }
        // Remove modal-open class
        document.body.classList.remove('modal-open');
        
        // Force a reset of any stale event handlers
        forceEventHandlerReset();
      }
    }, 50);
  }
}

// Reset event handlers by temporarily altering the DOM
function forceEventHandlerReset() {
  // Don't trigger DOM recalculation as it was causing unwanted refreshes
  // We'll use a simpler approach that won't disrupt the page
  
  // Just ensure the window.__modalOpen flag is properly reset
  window.__modalOpen = false;
  
  // Update the actual modal open count on the window object for consistency
  window.modalOpenCount = 0;
  
  // Clean up any scroll lock classes without triggering a reflow
  document.body.classList.remove('modal-open');
}

// Clean up any modal effects when navigating away
export function cleanupModalEffects() {
  modalOpenCount = 0;
  window.__modalOpen = false;
  
  if (documentBodyStyleBackup !== null && typeof document !== 'undefined') {
    document.body.style.cssText = documentBodyStyleBackup;
    document.body.classList.remove('modal-open');
  }
}