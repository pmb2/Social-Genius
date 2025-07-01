import { NextRequest, NextResponse } from 'next/server';
import NotificationService from '@/services/api/notification-service';
import { AuthService } from '@/services/auth';

// Get notifications for the authenticated user
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
    
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const unreadOnly = searchParams.get('unread') === 'true';
    
    // Get notifications for the user
    const notifications = await notificationService.getNotifications(
      session.user.id, 
      limit,
      unreadOnly
    );
    
    // Get unread count
    const unreadCount = await notificationService.getUnreadCount(session.user.id);
    
    return NextResponse.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// Mark notifications as read
export async function PUT(req: NextRequest) {
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
    
    // Parse request body
    const body = await req.json();
    
    if (body.markAll) {
      // Mark all notifications as read
      const count = await notificationService.markAllAsRead(session.user.id);
      return NextResponse.json({ success: true, count });
    } else if (body.notificationId) {
      // Mark a specific notification as read
      const success = await notificationService.markAsRead(
        parseInt(body.notificationId, 10),
        session.user.id
      );
      
      if (success) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json(
          { error: 'Failed to mark notification as read' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// Delete a notification
export async function DELETE(req: NextRequest) {
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
    
    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const notificationId = searchParams.get('id');
    
    if (!notificationId) {
      return NextResponse.json(
        { error: 'Missing notification ID' },
        { status: 400 }
      );
    }
    
    // Delete the notification
    const success = await notificationService.deleteNotification(
      parseInt(notificationId, 10),
      session.user.id
    );
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to delete notification' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}