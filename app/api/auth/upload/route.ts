import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '@/services/auth';

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authService = AuthService.getInstance();
    
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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Create a unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    // Create paths
    const relativePath = `/uploads/${fileName}`;
    const publicPath = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(publicPath, fileName);
    
    // Ensure uploads directory exists
    try {
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    } catch (error) {
      console.error('Failed to write file:', error);
      // Try to create the directory if it doesn't exist
      const { mkdir } = await import('fs/promises');
      await mkdir(publicPath, { recursive: true });
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    }
    
    // Update user's profile picture in the database
    const result = await authService.updateUserProfile(session.user.id, {
      profilePicture: relativePath
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update profile picture' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      profilePicture: relativePath
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}