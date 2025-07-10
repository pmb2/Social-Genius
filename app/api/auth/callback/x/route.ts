
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '@/services/database';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    console.log('[X_CALLBACK] GET function started.');
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const codeVerifier = session.codeVerifier;

    console.log('Session data:', { 
        hasCodeVerifier: !!codeVerifier, 
        codeVerifierLength: codeVerifier?.length,
        sessionKeys: Object.keys(session),
        sessionId: session.id || 'no-session-id',
        allSessionData: session
    });

    // // Additional debugging for cookies
    // const cookieHeader = req.headers.get('cookie');
    // console.log('Cookie header present:', !!cookieHeader);
    // console.log('Cookie header length:', cookieHeader?.length || 0);

    if (!code || !state) {
        console.error('Missing required OAuth parameters:', {
            hasCode: !!code,
            hasState: !!state,
            codeParam: code?.substring(0, 10) + '...',
            stateParam: state?.substring(0, 20) + '...'
        });
        return new NextResponse('Invalid OAuth request - missing code or state', { status: 400 });
    }

    if (!codeVerifier) {
        console.error('Code verifier not found in session. This indicates the OAuth flow was not properly initiated.');
        console.error('Session debug info:', {
            sessionExists: !!session,
            sessionKeys: Object.keys(session),
            sessionData: JSON.stringify(session, null, 2)
        });
        
        // Try to provide a more helpful error message
        return new NextResponse(
            'OAuth flow error: Code verifier not found. Please restart the authentication process.',
            { status: 400 }
        );
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

    console.log('Token exchange params:', {
        code: code.substring(0, 10) + '...',
        grant_type: 'authorization_code',
        client_id: process.env.X_CLIENT_ID,
        redirect_uri: process.env.X_REDIRECT_URI,
        code_verifier: codeVerifier.substring(0, 10) + '...'
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
        console.error('Token exchange failed:', {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            error: errorText,
            codeVerifierUsed: codeVerifier.substring(0, 10) + '...'
        });
        return new NextResponse('Failed to exchange code for token', { status: 400 });
    }

    const { access_token, refresh_token, expires_in } = await tokenResponse.json();

    // Clear the code verifier from session since it's single-use
    console.log('Clearing code verifier from session');
    session.codeVerifier = undefined;
    await session.save();
    
    // Verify the session was cleared
    console.log('Session after clearing code verifier:', {
        hasCodeVerifier: !!session.codeVerifier,
        sessionKeys: Object.keys(session)
    });

    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
            'Authorization': `Bearer ${access_token}`
        }
    });

    if (!userResponse.ok) {
        const errorText = await userResponse.text();
        // console.error('Failed to fetch user profile:', {
    //     status: userResponse.status,
    //     statusText: userResponse.statusText,
    //     error: errorText
    // });
        return new NextResponse('Failed to fetch user profile', { status: 400 });
    }

    const { data: xUser } = await userResponse.json();
    const xAccountId = xUser.id;
    const xUsername = xUser.username;
    const db = DatabaseService.getInstance();

    // Create proper base URL for redirects
    const requestUrl = new URL(req.url);
    let baseUrl: string;

    // Handle different host scenarios
    if (requestUrl.hostname === '0.0.0.0') {
        baseUrl = 'http://localhost:3000';
    } else if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
        baseUrl = `http://${requestUrl.hostname}:${requestUrl.port}`;
    } else {
        baseUrl = requestUrl.origin;
    }

    // console.log('Redirect base URL determined:', baseUrl);

    if (flow === 'login') {
        const user = await db.getUserByXAccountId(xAccountId);
        if (user) {
            session.id = user.id;
            session.isLoggedIn = true;
            console.log(`[X_CALLBACK] Login flow: Setting session.id to ${session.id} (user.id: ${user.id})`);
            await session.save();
            console.log(`[X_CALLBACK] Login flow: Session saved. session.id: ${session.id}, session.isLoggedIn: ${session.isLoggedIn}`);
            const redirectUrl = new URL('/dashboard', baseUrl);
            // console.log('Redirecting to:', redirectUrl.toString());
            return NextResponse.redirect(redirectUrl);
        } else {
            return NextResponse.redirect(new URL(`/app/auth/register?x_id=${xAccountId}&x_username=${xUsername}`, baseUrl));
        }
    } else if (flow === 'register') {
        const user = await db.getUserByXAccountId(xAccountId);
        if (user) {
            return NextResponse.redirect(new URL('/app/auth/register?error=x_account_exists', baseUrl));
        } else {
            return NextResponse.redirect(new URL(`/app/auth/complete-registration?x_id=${xAccountId}&x_username=${xUsername}`, baseUrl));
        }
    } else if (flow === 'link') {
        // console.log('Link flow initiated. stateUserId:', stateUserId);
    // console.log('X Account ID:', xAccountId, 'X Username:', xUsername);

        // Ensure the session reflects the authenticated user from the state
        console.log(`[X_CALLBACK] Link flow: stateUserId from decodedState: ${stateUserId}, type: ${typeof stateUserId}`);
        session.id = stateUserId;
        session.isLoggedIn = true;
        console.log(`[X_CALLBACK] Link flow: Setting session.id to ${session.id} (stateUserId: ${stateUserId})`);
        await session.save();
        console.log(`[X_CALLBACK] Link flow: Session saved. session.id: ${session.id}, session.isLoggedIn: ${session.isLoggedIn}`);

        const linkedAccount = await db.getLinkedAccountByXAccountId(xAccountId, stateUserId);
        // console.log('Result of getLinkedAccountByXAccountId:', linkedAccount);

        if (linkedAccount) {
            // console.log('X account already linked:', linkedAccount);
            return NextResponse.redirect(new URL('/dashboard?error=x_account_linked', baseUrl));
        } else {
            const client = await db.getPool().connect();
            try {
                console.log('[X_CALLBACK] Starting database transaction.');
                await client.query('BEGIN');
                const businessId = `bid_${Date.now()}`;
                console.log(`[X_CALLBACK] Generated businessId: ${businessId}`);
                
                // Create a business entry for the user before linking the account
                const businessName = `X Business for ${xUsername}`;
                console.log(`[X_CALLBACK] Calling addBusinessForUser with userId: ${stateUserId}, businessName: ${businessName}, businessId: ${businessId}`);
                await db.addBusinessForUser(stateUserId, businessName, businessId, client);
                console.log('[X_CALLBACK] addBusinessForUser completed successfully.');

                const accountData = {
                    userId: stateUserId,
                    businessId,
                    xAccountId,
                    xUsername,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    tokenExpiresAt: new Date(Date.now() + expires_in * 1000)
                };
                console.log('[X_CALLBACK] Calling addLinkedAccount with data:', accountData);
                await db.addLinkedAccount(accountData, client);
                console.log('[X_CALLBACK] addLinkedAccount completed successfully.');

                await client.query('COMMIT');
                console.log('[X_CALLBACK] Transaction committed successfully.');
                
                const redirectUrl = new URL('/dashboard?x_account_added=true', baseUrl);
                console.log(`[X_CALLBACK] Redirecting to: ${redirectUrl.toString()}`);
                const redirectResponse = NextResponse.redirect(redirectUrl);
                
                // Manually copy session cookies to the redirect response
                const sessionCookie = session.headers?.get('set-cookie');
                if (sessionCookie) {
                    console.log('[X_CALLBACK] Forwarding session cookie to redirect response.');
                    redirectResponse.headers.set('set-cookie', sessionCookie);
                }

                return redirectResponse;
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('[X_CALLBACK] Transaction failed, rolling back. Error:', error);
                if (error instanceof Error) {
                    console.error(`[X_CALLBACK] Error name: ${error.name}`);
                    console.error(`[X_CALLBACK] Error message: ${error.message}`);
                    console.error(`[X_CALLBACK] Error stack: ${error.stack}`);
                }
                return new NextResponse(`Failed to link X account due to a database error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
            } finally {
                console.log('[X_CALLBACK] Releasing database client.');
                client.release();
            }
        }
    } else {
        return new NextResponse('Invalid flow', { status: 400 });
    }
}
