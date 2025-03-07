import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth-middleware';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Get the current authenticated user's details
export const GET = async (req: NextRequest) => {
  return NextResponse.json(
    { message: "Authentication is being migrated to NextAuth" },
    { status: 200 }
  );
};