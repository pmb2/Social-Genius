'use client';

import { toast as sonnerToast } from 'sonner';

// Types
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';
type ToastOptions = {
  id?: string;
  duration?: number;
  icon?: React.ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
};

// Helper function for unified toast interface
export function toast(message: string, options?: ToastOptions): void;
export function toast(message: string, type?: ToastType, options?: ToastOptions): void;
export function toast(
  message: string,
  typeOrOptions?: ToastType | ToastOptions,
  optionsParam?: ToastOptions
): void {
  let type: ToastType = 'info';
  let options: ToastOptions = {};

  // Handle overloads
  if (typeof typeOrOptions === 'string') {
    type = typeOrOptions as ToastType;
    options = optionsParam || {};
  } else if (typeOrOptions) {
    options = typeOrOptions as ToastOptions;
  }

  // Call the appropriate sonner toast function based on type
  switch (type) {
    case 'success':
      sonnerToast.success(message, options);
      break;
    case 'error':
      sonnerToast.error(message, options);
      break;
    case 'info':
      sonnerToast.info(message, options);
      break;
    case 'warning':
      sonnerToast.warning(message, options);
      break;
    case 'loading':
      sonnerToast.loading(message, options);
      break;
    default:
      sonnerToast(message, options);
  }
}

// Re-export promise for async toasts
toast.promise = sonnerToast.promise;

// Re-export dismiss
toast.dismiss = sonnerToast.dismiss;

// Re-export custom method
toast.custom = sonnerToast.custom;

// Helper methods
toast.success = (message: string, options?: ToastOptions) => toast(message, 'success', options);
toast.error = (message: string, options?: ToastOptions) => toast(message, 'error', options);
toast.info = (message: string, options?: ToastOptions) => toast(message, 'info', options);
toast.warning = (message: string, options?: ToastOptions) => toast(message, 'warning', options);
toast.loading = (message: string, options?: ToastOptions) => toast(message, 'loading', options);

export default toast;