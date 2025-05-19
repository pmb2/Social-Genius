'use client';

import { toast } from './toast';

export type Toast = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
};

export function useToast() {
  function showToast({ title, description, variant = 'default', duration = 3000 }: Toast) {
    const type = variant === 'destructive' ? 'error' : 
                variant === 'success' ? 'success' : 'info';
    
    toast(title || '', {
      description,
      duration
    });
  }

  return {
    toast: showToast
  };
}

export default useToast;