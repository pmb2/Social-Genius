/**
 * Google Business Locations API Route
 * 
 * Handles retrieving and management of business locations from Google Business Profile API
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleBusinessProfileService } from '@/services/google/business-profile-service';
import { AuthService } from '@/services/auth';
import { DatabaseService } from '@/services/database';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

/**
 * GET handler - retrieves business locations
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
    
    // Get account info from database
    const accountResult = await db.query(
      'SELECT google_account_id FROM google_business_accounts WHERE business_id = $1',
      [businessId]
    );
    
    if (!accountResult || !accountResult.rows || accountResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No Google Business account associated with this business' },
        { status: 404 }
      );
    }
    
    const accountId = accountResult.rows[0].google_account_id;
    
    // Determine if we should force refresh from API
    const forceRefresh = searchParams.get('refresh') === 'true';
    
    // If not forcing refresh, try to get cached locations from database
    if (!forceRefresh) {
      const locationsResult = await db.getPool().query(
        'SELECT location_id, location_name, is_primary, address, phone_number, primary_category, website_url FROM google_business_locations WHERE business_id = $1',
        [businessId]
      );
      
      const locations = locationsResult.rows || [];
      
      if (locations.length > 0) {
        return NextResponse.json({
          success: true,
          locations: locations.map(location => ({
            id: location.location_id,
            name: location.location_name,
            isPrimary: location.is_primary,
            address: location.address,
            phoneNumber: location.phone_number,
            primaryCategory: location.primary_category,
            websiteUrl: location.website_url
          })),
          source: 'database'
        });
      }
    }
    
    // Get locations from the API
    const profileService = new GoogleBusinessProfileService();
    const locationsResponse = await profileService.getLocations(
      accountId,
      userId.toString(),
      businessId
    );
    
    // Format and return the locations
    const formattedLocations = await Promise.all(
      locationsResponse.locations.map(async (location, index) => {
        // Get detailed information for each location
        let locationDetails;
        try {
          locationDetails = await profileService.getLocationDetails(
            location.name,
            userId.toString(),
            businessId
          );
          
          // Update database with latest information
          await db.getPool().query(
            `UPDATE google_business_locations 
             SET location_name = $1, 
                 address = $2, 
                 phone_number = $3, 
                 primary_category = $4, 
                 website_url = $5,
                 updated_at = NOW()
             WHERE business_id = $6 AND location_id = $7`,
            [
              location.title,
              JSON.stringify(locationDetails.address || null),
              locationDetails.primaryPhone || null,
              locationDetails.categories?.primaryCategory?.displayName || null,
              locationDetails.websiteUrl || null,
              businessId,
              location.name
            ]
          );
        } catch (error) {
          console.error(`Error getting details for location ${location.name}:`, error);
          locationDetails = null;
        }
        
        return {
          id: location.name,
          name: location.title,
          isPrimary: index === 0, // First location is considered primary
          address: locationDetails?.address,
          phoneNumber: locationDetails?.primaryPhone,
          primaryCategory: locationDetails?.categories?.primaryCategory?.displayName,
          websiteUrl: locationDetails?.websiteUrl,
          isVerified: location.locationState?.isVerified,
          isPublished: location.locationState?.isPublished,
          metadata: location.metadata
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      locations: formattedLocations,
      source: 'api'
    });
  } catch (error) {
    console.error('Error retrieving Google Business Locations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retrieve business locations' 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler - updates a location's primary status
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
    const { businessId, locationId, isPrimary } = body;
    
    // Validate required fields
    if (!businessId || !locationId || typeof isPrimary !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: businessId, locationId, or isPrimary' },
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
    
    // Update primary status in database (requires transaction to ensure only one primary location)
    await db.query('BEGIN');
    
    try {
      if (isPrimary) {
        // Clear any existing primary location
        await db.query(
          'UPDATE google_business_locations SET is_primary = false WHERE business_id = $1',
          [businessId]
        );
        
        // Set new primary location
        await db.query(
          'UPDATE google_business_locations SET is_primary = true WHERE business_id = $1 AND location_id = $2',
          [businessId, locationId]
        );
      } else {
        // Only allow setting isPrimary to false if there's another primary location
        const primaryCount = await db.query(
          'SELECT COUNT(*) FROM google_business_locations WHERE business_id = $1 AND is_primary = true AND location_id != $2',
          [businessId, locationId]
        );
        
        if (primaryCount.rows[0].count === '0') {
          await db.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: 'Cannot remove primary status without another primary location' },
            { status: 400 }
          );
        }
        
        // Update the location
        await db.query(
          'UPDATE google_business_locations SET is_primary = false WHERE business_id = $1 AND location_id = $2',
          [businessId, locationId]
        );
      }
      
      await db.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: `Location ${isPrimary ? 'set as primary' : 'updated'} successfully`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update location' 
      },
      { status: 500 }
    );
  }
}