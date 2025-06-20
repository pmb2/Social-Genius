import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi, generateCodeVerifier } from 'twitter-api-v2';
import AuthService from '@/services/auth/auth-service';

const authService = AuthService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const twitterClientId = process.env.TWITTER_CLIENT_ID;
    const twitterRedirectUri = process.env.TWITTER_REDIRECT_URI;

    if (!twitterClientId || !twitterRedirectUri) {
      console.error('Twitter OAuth environment variables not configured.');
      return NextResponse.json(
        { error: 'Twitter OAuth not configured' },
        { status: 500 }
      );
    }

    // Get current user session if available
    const sessionCookie = request.cookies.get('session')?.value;
    let userId: number | null = null;
    if (sessionCookie) {
      const session = await authService.verifySession(sessionCookie);
      if (session?.user?.id) {
        userId = session.user.id;
        console.log(`Twitter OAuth: User ${userId} is already logged in, linking account.`);
      }
    }

    // Initialize Twitter API client for OAuth 2.0 PKCE
    const client = new TwitterApi({ clientId: twitterClientId });

    // Generate code verifier and challenge
    const codeVerifier = generateCodeVerifier();

    // Generate authorization URL
    const { url, state } = client.generateOAuth2AuthLink(twitterRedirectUri, {
      scope: ['tweet.read', 'users.read', 'offline.access'], // Request offline.access for refresh tokens
    });

    // Store state and code verifier in Redis for verification during callback
    // TTL for state and verifier should match the Twitter authorization window (e.g., 10 minutes = 600 seconds)
    const ttlSeconds = 600;
    await authService.setOAuthState(state, userId, 'twitter', ttlSeconds);
    await authService.setOAuthCodeVerifier(state, codeVerifier, ttlSeconds);

    // Redirect to Twitter authorization URL
    const response = NextResponse.redirect(url);

    // Set state and code verifier as HTTP-only cookies for the callback route
    // Note: Twitter's PKCE flow requires the code_verifier to be sent in the token exchange,
    // not necessarily as a cookie. We store it in Redis for server-side retrieval.
    // The state is typically passed as a query param and verified against a stored value.
    // For Next.js API routes, storing in Redis is more robust than cookies for state.
    // However, if we want to pass state via cookie for client-side verification or other reasons,
    // we can set it here. For now, Redis is sufficient for server-side state management.
    
    // For debugging, you might set a cookie, but it's not strictly necessary for PKCE if Redis is used.
    // response.cookies.set('twitter_oauth_state', state, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'lax',
    //   maxAge: ttlSeconds
    // });
    // response.cookies.set('twitter_oauth_code_verifier', codeVerifier, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'lax',
    //   maxAge: ttlSeconds
    // });

    console.log(`Twitter OAuth initiation successful. Redirecting to: ${url}`);
    return response;
  } catch (error) {
    console.error('Twitter OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Twitter OAuth' },
      { status: 500 }
    );
  }
}
