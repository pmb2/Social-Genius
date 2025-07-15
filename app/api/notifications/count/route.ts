import { NextRequest, NextResponse } from 'next/server';
import NotificationService from '@/services/api/notification-service';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Make sure route is always handled dynamically and never statically generated
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache this route

// Get unread notification count for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const notificationService = NotificationService.getInstance();

    if (!session.isLoggedIn || !session.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get unread count
    const unreadCount = await notificationService.getUnreadCount(session.id);
    
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