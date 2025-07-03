
import { NextRequest, NextResponse } from 'next/server';

export async function getXOAuthUrl(flow: 'login' | 'register' | 'link', userId?: string) {
  const params = new URLSearchParams({ flow });
  if (userId) {
    params.set('user_id', userId);
  }

  const response = await fetch(`/api/auth/x/login?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to get X OAuth URL');
  }

  const { url } = await response.json();
  return url;
}
