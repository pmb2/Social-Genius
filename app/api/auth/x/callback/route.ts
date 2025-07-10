
import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { DatabaseService } from '@/services/database';

interface XUser {
  id: string;
  name: string;
  username: string;
}

async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const params = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: process.env.X_CLIENT_ID as string,
    redirect_uri: process.env.X_REDIRECT_URI as string,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: params.toString(),
  });

  return response.json();
}

async function getXUserProfile(accessToken: string): Promise<XUser> {
  const response = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  const { data } = await response.json();
  return data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect('/auth/login?error=x_oauth_failed');
  }

  try {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const codeVerifier = session.codeVerifier;

    if (!code || !state || !codeVerifier) {
        return new NextResponse('Invalid request or missing code verifier', { status: 400 });
    }

    const decodedState = verify(state, process.env.JWT_SECRET as string) as { flow: string; userId?: string };
    const { flow, userId } = decodedState;

    const tokenData = await exchangeCodeForToken(code, codeVerifier);
    if (tokenData.error) {
      console.error('Error exchanging code for token:', tokenData.error);
      return NextResponse.redirect('/auth/login?error=x_oauth_failed');
    }

    const xUser = await getXUserProfile(tokenData.access_token);
    const db = DatabaseService.getInstance();

    if (flow === 'login') {
      // Handle login flow
    } else if (flow === 'register') {
      // Handle register flow
    } else if (flow === 'link') {
      // Handle link flow
    }

    return NextResponse.redirect('/dashboard');

  } catch (error) {
    console.error('X OAuth callback error:', error);
    return NextResponse.redirect('/auth/login?error=x_oauth_failed');
  }
}
