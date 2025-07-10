import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSession, SessionData } from '@/lib/auth/session';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const flow = searchParams.get('flow') || 'login'; // login, register, or link
    const userId = searchParams.get('userId'); // Required for link flow

    console.log('X OAuth authorization request:', { flow, userId });

    // For link flow, userId is required
    if (flow === 'link' && !userId) {
        return new NextResponse('User ID required for link flow', { status: 400 });
    }

    // Generate code verifier and challenge for PKCE
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    console.log('Generated PKCE parameters:', {
        codeVerifierLength: codeVerifier.length,
        codeChallengeLength: codeChallenge.length
    });

    // Store code verifier in session
    const session = await getSession();
    session.codeVerifier = codeVerifier;
    await session.save();

    console.log('Stored code verifier in session:', {
        codeVerifierLength: codeVerifier.length,
        sessionId: session.id || 'no-session-id',
        sessionKeys: Object.keys(session)
    });

    // Verify it was stored by reading it back
    const verifySession = await getIronSession<SessionData>(cookies(), sessionOptions);
    console.log('Verification - code verifier stored:', {
        hasCodeVerifier: !!verifySession.codeVerifier,
        codeVerifierLength: verifySession.codeVerifier?.length,
        matches: verifySession.codeVerifier === codeVerifier
    });

    // Create state JWT with flow information
    const statePayload: any = { flow };
    if (userId) {
        statePayload.userId = userId;
    }

    const state = jwt.sign(
        statePayload,
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
    );

    console.log('Created state JWT:', {
        flow,
        userId: userId || 'none',
        stateLength: state.length
    });

    // Build authorization URL with PKCE
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', process.env.X_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', process.env.X_REDIRECT_URI!);
    authUrl.searchParams.set('scope', 'tweet.read users.read offline.access');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('Redirecting to X OAuth:', {
        url: authUrl.toString().substring(0, 100) + '...',
        clientId: process.env.X_CLIENT_ID?.substring(0, 10) + '...',
        redirectUri: process.env.X_REDIRECT_URI
    });

    return NextResponse.redirect(authUrl.toString());
}
