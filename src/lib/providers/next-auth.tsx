'use client';

import { ReactNode } from 'react';

export function NextAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}