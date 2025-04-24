'use client';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // For demo purposes, we're not checking authentication anymore
  // Just render the children directly
  return <>{children}</>;
}