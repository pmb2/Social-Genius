import { NextRequest, NextResponse } from 'next/server';
import NotificationService from '@/services/api/notification-service';
import { AuthService } from '@/services/auth';

// Create a notification for a user (admin only or self)
export async function POST(req: NextRequest) {
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
    const { userId, title, message, type } = body;
    
    // Validate required fields
    if (!title || !message || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, message, and type are required' },
        { status: 400 }
      );
    }
    
    // Validate notification type
    if (!['info', 'success', 'warning', 'alert'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type. Must be one of: info, success, warning, alert' },
        { status: 400 }
      );
    }
    
    // Determine the target user ID
    const targetUserId = userId ? parseInt(userId, 10) : session.user.id;
    
    // Create the notification
    const notificationId = await notificationService.createNotification(
      targetUserId,
      title,
      message,
      type
    );
    
    return NextResponse.json({
      success: true,
      notificationId
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}