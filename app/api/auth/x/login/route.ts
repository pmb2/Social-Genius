
import { NextRequest, NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';

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

  const statePayload: { flow: string; userId?: string } = { flow };
  if (flow === 'link' && userId) {
    statePayload.userId = userId;
  }

  const state = sign(statePayload, process.env.JWT_SECRET as string, { expiresIn: '15m' });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID as string,
    redirect_uri: process.env.X_REDIRECT_URI as string,
    scope: 'users.read tweet.read',
    state: state,
    code_challenge: 'challenge',
    code_challenge_method: 'plain',
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
