import { NextRequest, NextResponse } from 'next/server';
import NotificationService from '@/services/api/notification-service';
import { AuthService } from '@/services/auth';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Make sure route is always handled dynamically and never statically generated
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache this route

// Get unread notification count for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const authService = AuthService.getInstance();
    const notificationService = NotificationService.getInstance();
    
    // Get session from cookies
    const cookieHeader = req.headers.get('cookie');
    const cookies = authService.parseCookies(cookieHeader);
    const sessionId = cookies['session'];
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify the session
    const session = await authService.verifySession(sessionId);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // Get unread count
    const unreadCount = await notificationService.getUnreadCount(session.user.id);
    
    return NextResponse.json({
      unreadCount
    });
  } catch (error) {
    console.error('Error getting notification count:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}