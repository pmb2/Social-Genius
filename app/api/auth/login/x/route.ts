import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Utility function to generate a random string for PKCE
function generateRandomString(length: number) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

// Utility function to sha256 hash and base64url encode
function sha256(plain: string) {
    return crypto
        .createHash('sha256')
        .update(plain)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const flow = searchParams.get('flow');

    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    if (!flow || !['login', 'register', 'link'].includes(flow)) {
        return new NextResponse('Invalid flow', { status: 400 });
    }

    const state = jwt.sign({ flow }, process.env.JWT_SECRET!, { expiresIn: '10m' });

    // Generate a cryptographically random code_verifier
    const codeVerifier = generateRandomString(128);

    // Derive the code_challenge from the code_verifier
    const codeChallenge = await sha256(codeVerifier);

    // Store the code_verifier in the session for later verification
    session.codeVerifier = codeVerifier;
    await session.save();

    const params = new URLSearchParams({
        client_id: process.env.X_CLIENT_ID!,
        redirect_uri: process.env.X_REDIRECT_URI!,
        scope: 'users.read tweet.read offline.access',
        response_type: 'code',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });

    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

    return NextResponse.redirect(authUrl);
}