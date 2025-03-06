import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authService = AuthService.getInstance();
    
    // Get session ID from cookie
    const sessionId = req.cookies.get('sessionId')?.value;
    
    if (sessionId) {
      // Logout user (delete session)
      await authService.logout(sessionId);
    }
    
    // Create response that will clear the cookie
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );
    
    // Clear session cookie by setting an expired date
    response.cookies.set({
      name: 'sessionId',
      value: '',
      expires: new Date(0),
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}