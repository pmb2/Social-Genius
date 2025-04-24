'use client';

import { ReactNode } from 'react';
import { NextAuthProvider } from './next-auth';
import { SessionProvider } from './session';
import { ToastProvider } from './toast';

export interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextAuthProvider>
      <SessionProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </SessionProvider>
    </NextAuthProvider>
  );
}