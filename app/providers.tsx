'use client';

import { SessionProvider } from "@auth/nextjs/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
