import { NextRequest, NextResponse } from 'next/server';
import { createAuthRoute } from '@/lib/auth-middleware';
import { authenticateGBP } from '@/services/compliance-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';
// Force dynamic behavior to prevent static generation errors
export const dynamic = 'force-dynamic';

// Enable debugging - set to false to reduce console output
const DEBUG_LOGGING = false;

/**
 * Controlled logging to reduce console spam
 */
const log = (message: string, level: 'info' | 'error' | 'warn' = 'info') => {
  // Always log errors regardless of debug setting
  if (DEBUG_LOGGING || level === 'error') {
    const prefix = '[VALIDATE API]';
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
};

/**
 * Validates Google credentials without creating a business
 * This endpoint is used to validate credentials before creating a business
 */
export const POST = createAuthRoute(async (req: NextRequest, userId: number) => {
  try {
    log(`GBP Validation request from user ID: ${userId}`);
    
    // Parse the request body
    const body = await req.json();
    const { email, password, encryptedPassword, nonce, version, browserInstanceId } = body;
    
    if (!email || (!password && !encryptedPassword)) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required',
        errorCode: 'MISSING_PARAMETERS'
      }, { status: 400 });
    }
    
    // Handle password decryption if needed
    let decryptedPassword = password;
    if (encryptedPassword) {
      try {
        const { decryptPassword } = await import('@/lib/utilities/password-decryption');
        // Replace the encrypted password data with the decrypted password
        decryptedPassword = decryptPassword({
          encryptedPassword,
          nonce,
          version
        });
      } catch (decryptError) {
        log(`Error decrypting password: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`, 'error');
        return NextResponse.json({
          success: false,
          error: 'Authentication error. Please try again.',
          errorCode: 'DECRYPTION_ERROR'
        }, { status: 400 });
      }
    }
    
    log(`Processing GBP credential validation, browser instance: ${browserInstanceId || 'none'}`);
    
    // Create a browser instance ID if not provided
    const instanceId = browserInstanceId || `temp-gbp-${Date.now()}`;
    
    // Call the authentication service with the validation flag
    // This flag tells the service not to store credentials
    const authResult = await authenticateGBP(
      0, // No business ID yet 
      { 
        email, 
        password: decryptedPassword, // Use the decrypted password
        persistBrowser: false,
        browserInstanceId: instanceId,
        validationOnly: true // Special flag for validation only
      },
      false // Don't store credentials
    );
    
    if (!authResult.success) {
      log(`GBP Validation failed: ${authResult.error || 'Unknown error'}`, 'error');
      return NextResponse.json({
        success: false,
        error: authResult.error || 'Authentication failed',
        errorCode: authResult.errorCode || 'AUTH_FAILED'
      }, { status: 400 });
    }
    
    log(`GBP Validation succeeded for credentials`);
    return NextResponse.json({
      success: true,
      message: 'Credentials validated successfully'
    });
  } catch (error) {
    log(`Error validating GBP credentials: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
});