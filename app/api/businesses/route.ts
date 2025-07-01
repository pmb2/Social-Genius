import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import PostgresService from '@/services/database/postgres-service';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

    const userId = parseInt(session.user.id);
        const dbService = PostgresService.getInstance();
        const businesses = await dbService.getBusinessesForUser(userId);

        return NextResponse.json({ success: true, businesses });
    } catch (error) {
        console.error('[BUSINESSES] Error fetching businesses:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch businesses' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      console.error('Unauthorized attempt to create business: No session or user ID found.');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const body = await req.json();
    const { name } = body;

    if (!name) {
        return NextResponse.json({ success: false, error: 'Business name is required' }, { status: 400 });
    }

    const dbService = PostgresService.getInstance();
    const businessId = await dbService.addBusinessForUser(userId, name);

    return NextResponse.json({
      success: true,
      message: 'Business created successfully',
      businessId,
    }, { status: 201 });

  } catch (error) {
    console.error('[BUSINESSES] Error creating business:', error);
    return NextResponse.json({ success: false, error: 'Failed to create business' }, { status: 500 });
  }
}
