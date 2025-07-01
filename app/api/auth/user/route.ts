import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth';

export async function PUT(req: NextRequest) {
  try {
    const authService = AuthService.getInstance();
    
    // Get session to verify the user
    const cookieHeader = req.headers.get('cookie');
    const cookies = authService.parseCookies(cookieHeader);
    const sessionId = cookies['session'];
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify session and get user
    const session = await authService.verifySession(sessionId);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    const { name, email, profilePicture, phoneNumber } = body;
    
    // Create updates object with only the fields that are provided
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    
    // Update the user profile
    const result = await authService.updateUserProfile(session.user.id, updates);
    
    if (result.success) {
      // Return updated user data
      const updatedSession = await authService.verifySession(sessionId);
      return NextResponse.json({ 
        success: true, 
        user: updatedSession?.user || session.user 
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update profile' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}