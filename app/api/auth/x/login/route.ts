
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const flow = searchParams.get('flow');
  const userId = searchParams.get('user_id'); // Only for link flow

  if (!flow || !['login', 'register', 'link'].includes(flow)) {
    return NextResponse.json({ error: 'Invalid flow' }, { status: 400 });
  }

  if (flow === 'link' && !userId) {
    return NextResponse.json({ error: 'User ID is required for link flow' }, { status: 400 });
  }

  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  const codeVerifier = crypto.randomBytes(32).toString('hex');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  session.codeVerifier = codeVerifier;
  await session.save();

  const statePayload: { flow: string; userId?: string } = { flow };
  if (flow === 'link' && userId) {
    statePayload.userId = userId;
  }

  const state = jwt.sign(statePayload, process.env.JWT_SECRET as string, { expiresIn: '15m' });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID as string,
    redirect_uri: process.env.X_REDIRECT_URI as string,
    scope: 'users.read tweet.read',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'plain',
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
