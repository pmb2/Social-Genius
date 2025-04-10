import { NextRequest, NextResponse } from 'next/server';
import { handleBusinessAuthentication } from '@/lib/compliance/auth-service';

/**
 * API route for handling business authentication with Google
 * Uses browser-use-api service for reliable authentication with captcha handling
 * 
 * @route POST /api/compliance/auth
 * @body { businessId: string, email: string, password: string, useAlternativeUrls?: boolean }
 * @returns Authentication result with token and permissions
 */
export async function POST(req: NextRequest) {
  try {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    console.log(`[API ${timestamp}] Compliance auth API route called`);
    
    const data = await req.json();
    
    // Validate required fields
    if (!data.businessId || !data.email || (!data.password && !data.encryptedPassword)) {
      return NextResponse.json(
        { 
          authenticated: false, 
          error: 'Missing required parameters: businessId, email, and password' 
        },
        { status: 400 }
      );
    }
    
    // Handle password decryption if needed
    if (data.encryptedPassword) {
      try {
        const { decryptPassword } = await import('@/lib/utilities/password-decryption');
        // Replace the encrypted password data with the decrypted password
        data.password = decryptPassword({
          encryptedPassword: data.encryptedPassword,
          nonce: data.nonce,
          version: data.version
        });
        
        // Remove the encrypted data to prevent it from being logged or stored
        delete data.encryptedPassword;
        delete data.nonce;
        delete data.version;
      } catch (decryptError) {
        console.error('Error decrypting password:', decryptError);
        return NextResponse.json(
          { 
            authenticated: false, 
            error: 'Authentication error. Please try again.' 
          },
          { status: 400 }
        );
      }
    }
    
    console.log(`[API ${timestamp}] Starting authentication for business ID: ${data.businessId}`);
    
    // Handle authentication through our service
    const result = await handleBusinessAuthentication(
      data.businessId,
      {
        email: data.email,
        password: data.password,
        useAlternativeUrls: data.useAlternativeUrls || false
      }
    );
    
    // Full authentication result is returned to the client
    return NextResponse.json(result);
  } catch (error) {
    console.error('Compliance auth error:', error);
    return NextResponse.json(
      { 
        authenticated: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SERVER_ERROR'
      },
      { status: 500 }
    );
  }
}