import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth-middleware';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Get the current authenticated user's details
export const GET = createAuthRoute(async (req: NextRequest, userId: number) => {
  const dbService = PostgresService.getInstance();
  
  try {
    const user = await dbService.getUserById(userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Don't return sensitive information like password hash
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
    
    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// Special endpoint for authenticated routes to use directly
export async function getUserById(userId: number) {
  const dbService = PostgresService.getInstance();
  
  try {
    const user = await dbService.getUserById(userId);
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return null;
  }
}