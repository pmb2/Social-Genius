import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Assuming authOptions is exported from this path

// This is a placeholder for your database service or ORM
// You would typically import your Prisma client or similar here.
// For example:
// import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // --- START ADDITION ---
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      console.error('Unauthorized attempt to create business: No session or user ID found.');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const userId = session.user.id;
    // --- END ADDITION ---

    console.log('[BUSINESSES] Creating business for user ID:', userId); // Update this log to use the dynamic userId

    const body = await req.json();
    const { businessName, address, phone, email /* ... other existing fields ... */ } = body;

    // Ensure that any existing hardcoded `userId` or default `3` is replaced
    // with the `userId` variable obtained from the session.
    // For example, if you have:
    // const defaultUserId = 3;
    // Or:
    // const userId = req.body.userId || 3;
    // These should be removed or updated to use the `userId` from the session.

    // --- Placeholder for your existing business creation logic ---
    // This is where you would interact with your database to create the business.
    // Make sure to pass the `userId` obtained from the session.
    // Example using Prisma:
    /*
    const newBusiness = await prisma.business.create({
      data: {
        name: businessName,
        address: address,
        phone: phone,
        email: email,
        userId: userId, // Use the dynamic userId from the session
        // ... other fields
      },
    });
    */

    // For demonstration, returning a success message with the dynamic userId
    console.log(`[BUSINESSES] Business "${businessName}" for user ${userId} would be created.`);

    return NextResponse.json({
      success: true,
      message: 'Business creation initiated successfully (check logs for details)',
      // If you have a newBusiness object from your DB operation, return it here:
      // business: newBusiness,
    }, { status: 201 });

  } catch (error) {
    console.error('[BUSINESSES] Error creating business:', error);
    return NextResponse.json({ success: false, error: 'Failed to create business' }, { status: 500 });
  }
}
