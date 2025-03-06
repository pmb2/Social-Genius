import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// This route is replaced by NextAuth's [...nextauth]/session route
// You should use the getSession() function from next-auth/react on the client side
export async function GET(req: NextRequest) {
  return NextResponse.json({
    error: "This endpoint is deprecated. Please use NextAuth session endpoint instead.",
    redirectTo: "/api/auth/session"
  }, { status: 308 });
}