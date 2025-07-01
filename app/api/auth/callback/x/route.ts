import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '@/services/postgres-service';
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

    const tokenResponse = await fetch('https://api.x.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`
        },
        body: new URLSearchParams({
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: process.env.X_REDIRECT_URI!,
            code_verifier: codeVerifier
        })
    });

    if (!tokenResponse.ok) {
        return new NextResponse('Failed to exchange code for token', { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = await tokenResponse.json();

    const userResponse = await fetch('https://api.x.com/2/users/me', {
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

    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    if (flow === 'login') {
        const { rows } = await pool.query('SELECT * FROM users WHERE x_account_id = $1', [xAccountId]);
        if (rows.length > 0) {
            const user = rows[0];
            session.id = user.id;
            session.isLoggedIn = true;
            await session.save();
            return NextResponse.redirect(new URL('/app/(protected)/dashboard', req.url));
        } else {
            return NextResponse.redirect(new URL(`/app/auth/register?x_id=${xAccountId}&x_username=${xUsername}`, req.url));
        }
    } else if (flow === 'register') {
        const { rows } = await pool.query('SELECT * FROM users WHERE x_account_id = $1', [xAccountId]);
        if (rows.length > 0) {
            return NextResponse.redirect(new URL('/app/auth/register?error=x_account_exists', req.url));
        } else {
            return NextResponse.redirect(new URL(`/app/auth/complete-registration?x_id=${xAccountId}&x_username=${xUsername}`, req.url));
        }
    } else if (flow === 'link') {
        if (!stateUserId) {
            return new NextResponse('User not authenticated', { status: 400 });
        }

        const { rows } = await pool.query('SELECT * FROM linked_accounts WHERE x_account_id = $1', [xAccountId]);
        if (rows.length > 0) {
            return NextResponse.redirect(new URL('/app/(protected)/dashboard?error=x_account_linked', req.url));
        } else {
            const businessId = `bid_${Date.now()}`;
            await pool.query(
                'INSERT INTO linked_accounts (user_id, business_id, x_account_id, x_username, access_token, refresh_token, token_expires_at) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL \'1 hour\' * $7)',
                [stateUserId, businessId, xAccountId, xUsername, access_token, refresh_token, expires_in / 3600]
            );
            return NextResponse.redirect(new URL('/app/(protected)/dashboard?success=x_account_added', req.url));
        }
    } else {
        return new NextResponse('Invalid flow', { status: 400 });
    }
}