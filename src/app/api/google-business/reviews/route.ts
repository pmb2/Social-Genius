/**
 * Google Business Profile Reviews API
 * 
 * Handles review retrieval and responding to reviews with GBP API
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google/oauth-service';
import { GoogleBusinessProfileService } from '@/services/google/business-profile-service';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * GET: Retrieve reviews for a business
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
    
    // Get reviews
    const profileService = new GoogleBusinessProfileService(accessToken);
    
    // In the official implementation, this would use the GBP API to fetch reviews
    // For now, we'll return a mock response
    const reviews = [
      {
        name: 'locations/123/reviews/abc123',
        reviewId: 'abc123',
        reviewer: {
          displayName: 'John Doe',
          profilePhotoUrl: 'https://example.com/photo.jpg'
        },
        starRating: 4,
        comment: 'Great service, would recommend!',
        createTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        reviewReply: {
          comment: 'Thank you for your feedback!',
          updateTime: new Date().toISOString()
        }
      },
      {
        name: 'locations/123/reviews/def456',
        reviewId: 'def456',
        reviewer: {
          displayName: 'Jane Smith',
          profilePhotoUrl: 'https://example.com/photo2.jpg'
        },
        starRating: 5,
        comment: 'Excellent products and customer service.',
        createTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updateTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ];
    
    return NextResponse.json({ 
      success: true, 
      reviews
    });
  } catch (error) {
    console.error('Error fetching Google Business Profile reviews:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch reviews' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Respond to a review
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
    const { businessId, reviewId, comment } = body;
    
    if (!businessId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business ID is required' 
      }, { status: 400 });
    }
    
    if (!reviewId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Review ID is required' 
      }, { status: 400 });
    }
    
    if (!comment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Reply comment is required' 
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
    
    // Respond to review
    const profileService = new GoogleBusinessProfileService(accessToken);
    
    // In the official implementation, this would use the GBP API to respond to a review
    // For now, we'll return a mock response
    const reviewReply = {
      name: `locations/${locationId}/reviews/${reviewId}/reply`,
      comment,
      updateTime: new Date().toISOString()
    };
    
    return NextResponse.json({ 
      success: true, 
      reviewReply
    });
  } catch (error) {
    console.error('Error responding to Google Business Profile review:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to respond to review' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete a review reply
 */
export async function DELETE(req: NextRequest) {
  try {
    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const businessId = searchParams.get('businessId');
    const reviewId = searchParams.get('reviewId');
    
    if (!businessId || !reviewId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Business ID and Review ID are required' 
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
    
    // Get access token
    const oauthService = new GoogleOAuthService();
    const accessToken = await oauthService.getAccessToken(userId.toString(), businessId);
    
    // Delete review reply (this is a placeholder - the actual implementation would use the GBP API)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Review reply deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting Google Business Profile review reply:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete review reply' 
      },
      { status: 500 }
    );
  }
}