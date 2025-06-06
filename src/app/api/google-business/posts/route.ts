/**
 * Google Business Profile Posts API
 * 
 * Handles post creation, retrieval, updating, and deletion for GBP
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google/oauth-service';
import { GoogleBusinessProfileService } from '@/services/google/business-profile-service';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * GET: Retrieve posts for a business
 */
export async function GET(req: NextRequest) {
  try {
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business ID is required' 
      }, { status: 400 });
    }
    
    // Verify user is authenticated
    const authService = AuthService.getInstance();
    
    // Get session cookie
    const cookieHeader = req.headers.get('cookie');
    const cookies = authService.parseCookies(cookieHeader || '');
    const sessionId = cookies.session || cookies.sessionId;
    
    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Verify that the session is valid
    const session = await authService.verifySession(sessionId);
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session' 
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Verify user has access to this business
    const db = DatabaseService.getInstance();
    const businessResult = await db.query(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );
    
    if (!businessResult || !businessResult.rows || businessResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business not found or access denied' 
      }, { status: 403 });
    }
    
    // Get account and location info from database
    const locationResult = await db.query(
      `SELECT l.location_id, a.google_account_id 
       FROM google_business_locations l
       JOIN google_business_accounts a ON l.business_id = a.business_id
       WHERE l.business_id = $1 AND l.is_primary = true`,
      [businessId]
    );
    
    if (!locationResult || !locationResult.rows || locationResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No Google Business Profile locations found for this business' 
      }, { status: 404 });
    }
    
    const locationData = locationResult.rows[0];
    
    // Get access token
    const oauthService = new GoogleOAuthService();
    const accessToken = await oauthService.getAccessToken(userId.toString(), businessId);
    
    // Get posts
    const profileService = new GoogleBusinessProfileService(accessToken);
    
    // In the official implementation, this would use the GBP API to fetch posts
    // For now, we'll return a mock response
    const posts = [
      {
        name: 'locations/123/localPosts/abc123',
        languageCode: 'en',
        summary: 'Check out our new products!',
        state: 'LIVE',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        event: {
          title: 'New Product Launch',
          schedule: {
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      }
    ];
    
    return NextResponse.json({ 
      success: true, 
      posts
    });
  } catch (error) {
    console.error('Error fetching Google Business Profile posts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch posts' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new post for a business
 */
export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authService = AuthService.getInstance();
    
    // Get session cookie
    const cookieHeader = req.headers.get('cookie');
    const cookies = authService.parseCookies(cookieHeader || '');
    const sessionId = cookies.session || cookies.sessionId;
    
    if (!sessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Verify that the session is valid
    const session = await authService.verifySession(sessionId);
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid or expired session' 
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get request body
    const body = await req.json();
    const { businessId, summary, callToAction, media, event } = body;
    
    if (!businessId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business ID is required' 
      }, { status: 400 });
    }
    
    if (!summary) {
      return NextResponse.json({ 
        success: false, 
        error: 'Post content (summary) is required' 
      }, { status: 400 });
    }
    
    // Verify user has access to this business
    const db = DatabaseService.getInstance();
    const businessResult = await db.query(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );
    
    if (!businessResult || !businessResult.rows || businessResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business not found or access denied' 
      }, { status: 403 });
    }
    
    // Get account and location info from database
    const locationResult = await db.query(
      `SELECT l.location_id, a.google_account_id 
       FROM google_business_locations l
       JOIN google_business_accounts a ON l.business_id = a.business_id
       WHERE l.business_id = $1 AND l.is_primary = true`,
      [businessId]
    );
    
    if (!locationResult || !locationResult.rows || locationResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No Google Business Profile locations found for this business' 
      }, { status: 404 });
    }
    
    const locationData = locationResult.rows[0];
    const locationId = locationData.location_id;
    
    // Get access token
    const oauthService = new GoogleOAuthService();
    const accessToken = await oauthService.getAccessToken(userId.toString(), businessId);
    
    // Create post
    const profileService = new GoogleBusinessProfileService(accessToken);
    
    // In the official implementation, this would use the GBP API to create a post
    // For now, we'll return a mock response
    const post = {
      name: `locations/${locationId}/localPosts/${Date.now()}`,
      languageCode: 'en',
      summary,
      state: 'LIVE',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      ...(callToAction && { callToAction }),
      ...(media && { media }),
      ...(event && { event })
    };
    
    return NextResponse.json({ 
      success: true, 
      post
    });
  } catch (error) {
    console.error('Error creating Google Business Profile post:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create post' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH: Update an existing post
 */
export async function PATCH(req: NextRequest) {
  try {
    // Similar authentication and validation as POST
    // Implementation would follow the same pattern
    
    return NextResponse.json({ 
      success: true, 
      message: 'Post update API not yet implemented'
    }, { status: 501 });
  } catch (error) {
    console.error('Error updating Google Business Profile post:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update post' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a post
 */
export async function DELETE(req: NextRequest) {
  try {
    // Similar authentication and validation as POST
    // Implementation would follow the same pattern
    
    return NextResponse.json({ 
      success: true, 
      message: 'Post deletion API not yet implemented'
    }, { status: 501 });
  } catch (error) {
    console.error('Error deleting Google Business Profile post:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete post' 
      },
      { status: 500 }
    );
  }
}