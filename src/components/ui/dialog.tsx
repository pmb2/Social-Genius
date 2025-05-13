import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/utils/common"

// Create a context to track dialog state
const DialogStateContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

// Create a custom Dialog component that tracks its own state
const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
    onCleanup?: () => void;
  }
>(({ children, open, onOpenChange, onCleanup, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(open || false);
  
  // Sync with external open state
  React.useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);
  
  // Custom open change handler with cleanup
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    setIsOpen(newOpen);
    
    if (!newOpen) {
      // Run cleanup logic when dialog closes
      setTimeout(() => {
        if (onCleanup) onCleanup();
        
        // Force focus back to the body
        if (document.body) {
          document.body.focus();
        }
        
        // Remove any lingering overlay effects
        document.documentElement.style.pointerEvents = '';
        document.body.style.pointerEvents = '';
      }, 100);
    }
    
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  }, [onOpenChange, onCleanup]);
  
  return (
    <DialogStateContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
      <DialogPrimitive.Root
        ref={ref}
        open={isOpen}
        onOpenChange={handleOpenChange}
        {...props}
      >
        {typeof children === 'function' 
          ? children({ isOpen, setIsOpen: handleOpenChange }) 
          : children}
      </DialogPrimitive.Root>
    </DialogStateContext.Provider>
  );
});
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description

// Create a custom Close component
const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ ...props }, ref) => {
  const { setIsOpen } = React.useContext(DialogStateContext);
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (props.onClick) props.onClick(e);
    setIsOpen(false);
    
    // Restore pointer events
    setTimeout(() => {
      document.documentElement.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
    }, 100);
  };
  
  return (
    <DialogPrimitive.Close
      ref={ref}
      onClick={handleClick}
      {...props}
    />
  );
});
DialogClose.displayName = DialogPrimitive.Close.displayName;

// Improved overlay with guaranteed cleanup
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const { isOpen } = React.useContext(DialogStateContext);
  
  // Ensure cleanup when component unmounts
  React.useEffect(() => {
    return () => {
      document.documentElement.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
    };
  }, []);
  
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// Fixed content component that properly manages focus and cleanup
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onEscapeKeyDown, onPointerDownOutside, ...props }, ref) => {
  const { isOpen, setIsOpen } = React.useContext(DialogStateContext);
  
  // Handle escape key with guaranteed cleanup
  const handleEscapeKeyDown = (e: React.KeyboardEvent) => {
    if (onEscapeKeyDown) onEscapeKeyDown(e);
    
    // Ensure pointer events are restored
    setTimeout(() => {
      document.documentElement.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
    }, 100);
  };
  
  // Handle outside click with guaranteed cleanup
  const handlePointerDownOutside = (e: React.PointerEvent) => {
    if (onPointerDownOutside) onPointerDownOutside(e);
    
    // Ensure pointer events are restored
    setTimeout(() => {
      document.documentElement.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
    }, 100);
  };
  
  // Guaranteed cleanup when component unmounts
  React.useEffect(() => {
    // Force a reflow when dialog content mounts to prevent style issues
    if (isOpen) {
      document.body.offsetHeight;
    }
    
    return () => {
      // Clean up when content unmounts
      document.documentElement.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
      
      // Force a refresh on the document element to fix event issues
      if (typeof document !== 'undefined') {
        const refreshEvent = new Event('pointerup', { bubbles: true });
        document.dispatchEvent(refreshEvent);
      }
    };
  }, [isOpen]);
  
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        onEscapeKeyDown={handleEscapeKeyDown}
        onPointerDownOutside={handlePointerDownOutside}
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[95vw] h-auto max-h-[95vh] z-50 bg-white shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-xl overflow-auto",
          isOpen ? "pointer-events-auto" : "pointer-events-none",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

// Unchanged helper components
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left px-6 py-4", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 px-6 py-4", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-6 py-4", className)}
    {...props}
  />
);
DialogBody.displayName = "DialogBody";

export { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogClose, 
  DialogOverlay, 
  DialogPortal,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogBody
}