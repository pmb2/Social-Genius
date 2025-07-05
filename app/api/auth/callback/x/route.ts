
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '@/services/database';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const codeVerifier = session.codeVerifier;

    if (!code || !state || !codeVerifier) {
        return new NextResponse('Invalid request or missing code verifier', { status: 400 });
    }

    let decodedState: any;
    try {
        decodedState = jwt.verify(state, process.env.JWT_SECRET!);
    } catch (error) {
        return new NextResponse('Invalid state', { status: 400 });
    }

    const { flow, userId: stateUserId } = decodedState;

    const params = new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: process.env.X_CLIENT_ID!,
        redirect_uri: process.env.X_REDIRECT_URI!,
        code_verifier: codeVerifier
    });

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`
        },
        body: params.toString()
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Failed to exchange code for token:', errorText);
        return new NextResponse('Failed to exchange code for token', { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = await tokenResponse.json();

    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
            'Authorization': `Bearer ${access_token}`
        }
    });

    if (!userResponse.ok) {
        return new NextResponse('Failed to fetch user profile', { status: 400 });
    }

    const { data: xUser } = await userResponse.json();
    const xAccountId = xUser.id;
    const xUsername = xUser.username;
    const db = DatabaseService.getInstance();

    if (flow === 'login') {
        const user = await db.getUserByXAccountId(xAccountId);
        if (user) {
            session.id = user.id;
            session.isLoggedIn = true;
            await session.save();
            return NextResponse.redirect(new URL('/app/(protected)/dashboard', req.url));
        } else {
            return NextResponse.redirect(new URL(`/app/auth/register?x_id=${xAccountId}&x_username=${xUsername}`, req.url));
        }
    } else if (flow === 'register') {
        const user = await db.getUserByXAccountId(xAccountId);
        if (user) {
            return NextResponse.redirect(new URL('/app/auth/register?error=x_account_exists', req.url));
        } else {
            return NextResponse.redirect(new URL(`/app/auth/complete-registration?x_id=${xAccountId}&x_username=${xUsername}`, req.url));
        }
    } else if (flow === 'link') {
        if (!stateUserId) {
            return new NextResponse('User not authenticated', { status: 400 });
        }

        const linkedAccount = await db.getLinkedAccountByXAccountId(xAccountId);
        if (linkedAccount) {
            return NextResponse.redirect(new URL('/app/(protected)/dashboard?error=x_account_linked', req.url));
        } else {
            const client = await db.getPool().connect();
            try {
                await client.query('BEGIN');
                const businessId = `bid_${Date.now()}`;
                // Create a business entry for the user before linking the account
                await db.addBusinessForUser(stateUserId, `X Business for ${xUsername}`, businessId, client);
                await db.addLinkedAccount({
                    userId: stateUserId,
                    businessId,
                    xAccountId,
                    xUsername,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
                }, client);
                await client.query('COMMIT');
                return NextResponse.redirect(new URL('/app/(protected)/dashboard?success=x_account_added', req.url));
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('Transaction failed, rolling back:', error);
                return new NextResponse('Failed to link X account due to a database error', { status: 500 });
            } finally {
                client.release();
            }
        }
    } else {
        return new NextResponse('Invalid flow', { status: 400 });
    }
}
