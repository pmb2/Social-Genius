import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import AuthService from '@/services/auth/auth-service';

export async function GET(req: NextRequest) {
    try {
        const session = await getIronSession(cookies(), sessionOptions);

        console.log('[BUSINESS] /api/businesses: Session:', session);
        if (!session || !session.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.id;
        console.log(`[BUSINESS] /api/businesses: Fetching businesses for user ID: ${userId}`);
        const authService = AuthService.getInstance();
        const businesses = await authService.getBusinesses(userId as string);

        console.log('[BUSINESS] /api/businesses: Fetched businesses:', JSON.stringify(businesses, null, 2));

        return NextResponse.json({ success: true, businesses });
    } catch (error) {
        console.error('[BUSINESSES] Error fetching businesses:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch businesses' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession(cookies(), sessionOptions);

    if (!session || !session.id) {
      console.error('Unauthorized attempt to create business: No session or user ID found.');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userId = session.id;
    const body = await req.json();
    const { name } = body;

    if (!name) {
        return NextResponse.json({ success: false, error: 'Business name is required' }, { status: 400 });
    }

    const authService = AuthService.getInstance();
    const result = await authService.addBusiness(userId as string, name);

    if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Business created successfully',
          businessId: result.businessId,
        }, { status: 201 });
    } else {
        return NextResponse.json({ success: false, error: result.error || 'Failed to create business' }, { status: 500 });
    }

    } catch (error) {
    console.error('[BUSINESSES] Error creating business:', error);
    return NextResponse.json({ success: false, error: 'Failed to create business' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getIronSession(cookies(), sessionOptions);

    if (!session || !session.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.id;
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'Business ID is required' }, { status: 400 });
    }

    const authService = AuthService.getInstance();
    const result = await authService.deleteBusiness(userId, businessId);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Business soft-deleted successfully' });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Failed to soft-delete business' }, { status: 500 });
    }
  } catch (error) {
    console.error('[BUSINESSES] Error deleting business:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete business' }, { status: 500 });
  }
}''