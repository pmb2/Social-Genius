/**
 * Google Business Profile API Route
 * 
 * Handles retrieving business profile information from Google Business Profile API
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleBusinessProfileService } from '@/services/google/business-profile-service';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * GET handler - retrieves business profile information
 */
export async function GET(req: NextRequest) {
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
    
    // Get business ID from query params
    const searchParams = req.nextUrl.searchParams;
    const businessId = searchParams.get('businessId');
    
    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'Business ID is required' },
        { status: 400 }
      );
    }
    
    // Verify that the user owns this business
    const db = DatabaseService.getInstance();
    const businessResult = await db.query(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );
    
    if (!businessResult || !businessResult.rows || businessResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Business not found or not owned by this user' },
        { status: 404 }
      );
    }
    
    // Get account and location info from database
    const accountResult = await db.query(
      'SELECT google_account_id, google_account_name FROM google_business_accounts WHERE business_id = $1',
      [businessId]
    );
    
    if (!accountResult || !accountResult.rows || accountResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No Google Business account associated with this business' },
        { status: 404 }
      );
    }
    
    const account = accountResult.rows[0];
    
    // Get all locations for this business from database
    const locationsResult = await db.query(
      'SELECT location_id, location_name, is_primary FROM google_business_locations WHERE business_id = $1',
      [businessId]
    );
    
    const locations = locationsResult.rows || [];
    
    // Get the primary location details from the API
    const primaryLocation = locations.find(loc => loc.is_primary) || locations[0];
    
    if (!primaryLocation) {
      return NextResponse.json(
        { success: false, error: 'No locations found for this business' },
        { status: 404 }
      );
    }
    
    // Get detailed location info from the API
    const profileService = new GoogleBusinessProfileService();
    const locationDetails = await profileService.getLocationDetails(
      primaryLocation.location_id,
      userId.toString(),
      businessId
    );
    
    // Format the response
    return NextResponse.json({
      success: true,
      business: {
        id: businessId,
        account: {
          id: account.google_account_id,
          name: account.google_account_name
        },
        primaryLocation: {
          id: primaryLocation.location_id,
          name: primaryLocation.location_name,
          details: locationDetails
        },
        locations: locations.map(location => ({
          id: location.location_id,
          name: location.location_name,
          isPrimary: location.is_primary
        }))
      }
    });
  } catch (error) {
    console.error('Error retrieving Google Business Profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve business profile' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler - updates business profile information
 */
export async function PATCH(req: NextRequest) {
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
    const { businessId, locationId, updateData, updateMask } = body;
    
    // Validate required fields
    if (!businessId || !locationId || !updateData || !updateMask || !Array.isArray(updateMask)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: businessId, locationId, updateData, or updateMask' },
        { status: 400 }
      );
    }
    
    // Verify that the user owns this business
    const db = DatabaseService.getInstance();
    const businessResult = await db.query(
      'SELECT id FROM businesses WHERE id = $1 AND user_id = $2',
      [businessId, userId]
    );
    
    if (!businessResult || !businessResult.rows || businessResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Business not found or not owned by this user' },
        { status: 404 }
      );
    }
    
    // Verify that this location belongs to the business
    const locationResult = await db.query(
      'SELECT location_id FROM google_business_locations WHERE business_id = $1 AND location_id = $2',
      [businessId, locationId]
    );
    
    if (!locationResult || !locationResult.rows || locationResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Location not found for this business' },
        { status: 404 }
      );
    }
    
    // Update the location in the API
    const profileService = new GoogleBusinessProfileService();
    const updatedLocation = await profileService.updateLocationDetails(
      locationId,
      updateData,
      updateMask,
      userId.toString(),
      businessId
    );
    
    return NextResponse.json({
      success: true,
      location: updatedLocation
    });
  } catch (error) {
    console.error('Error updating Google Business Profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update business profile' 
      },
      { status: 500 }
    );
  }
}