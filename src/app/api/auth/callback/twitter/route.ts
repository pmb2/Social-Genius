import { NextRequest, NextResponse } from 'next/server';
import AuthService from '@/services/auth/auth-service';
// No need to import TwitterApi here, as we only use fetch for API calls

export async function GET(request: NextRequest) {
  const authService = AuthService.getInstance();
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    if (error) {
      console.error('Twitter OAuth error received:', error);
      // Redirect with a more specific error message
      return NextResponse.redirect(`/auth?error=twitter_oauth_denied&details=${encodeURIComponent(error)}`);
    }
    
    if (!code || !state) {
      console.error('Twitter OAuth: Missing code or state in callback.');
      return NextResponse.redirect('/auth?error=twitter_oauth_invalid_params');
    }
    
    // Retrieve stored state data and code verifier from Redis
    const storedStateData = await authService.getOAuthState(state);
    const storedCodeVerifier = await authService.getOAuthCodeVerifier(state);

    // Clear them immediately to prevent replay attacks, regardless of success
    await authService.clearOAuthState(state);
    await authService.clearOAuthCodeVerifier(state);

    if (!storedStateData || storedStateData.platform !== 'twitter') {
      console.error('Twitter OAuth: State mismatch or invalid platform in stored data.');
      return NextResponse.redirect('/auth?error=twitter_oauth_state_mismatch');
    }

    if (!storedCodeVerifier) {
      console.error('Twitter OAuth: Code verifier not found or expired for state:', state);
      return NextResponse.redirect('/auth?error=twitter_oauth_code_verifier_missing');
    }
    
    const twitterClientId = process.env.TWITTER_CLIENT_ID;
    const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET;
    const twitterRedirectUri = process.env.TWITTER_REDIRECT_URI;

    if (!twitterClientId || !twitterClientSecret || !twitterRedirectUri) {
      console.error('Twitter OAuth environment variables not configured for callback.');
      return NextResponse.redirect('/auth?error=twitter_oauth_config_missing');
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${twitterClientId}:${twitterClientSecret}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: twitterClientId,
        redirect_uri: twitterRedirectUri,
        code_verifier: storedCodeVerifier // Use the retrieved verifier
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Twitter token exchange failed:', errorText);
      // Provide more details in the error redirect
      return NextResponse.redirect(`/auth?error=twitter_token_exchange_failed&details=${encodeURIComponent(errorText.substring(0, 100))}`);
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('Twitter user fetch failed:', errorText);
      // Provide more details in the error redirect
      return NextResponse.redirect(`/auth?error=twitter_user_fetch_failed&details=${encodeURIComponent(errorText.substring(0, 100))}`);
    }
    
    const twitterUser = await userResponse.json();
    
    // Integrate with AuthService to create or get user session
    // Assuming twitterUser.data contains 'id' and 'name'
    const { id: platformUserId, name: username } = twitterUser.data; 
    const { access_token, refresh_token, expires_in } = tokens;

    // Calculate expiration date for the access token
    const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;
    
    // The existingUserId comes from the state stored during the signin process
    const existingUserId = storedStateData.userId; 

    const sessionResult = await authService.createOrGetUserSession(
      'twitter', // platform
      platformUserId,
      username,
      access_token,
      refresh_token,
      expiresAt,
      existingUserId
    );

    if (!sessionResult.success || !sessionResult.user) {
      console.error('Failed to create or get user session after Twitter OAuth:', sessionResult.error);
      return NextResponse.redirect(`/auth?error=twitter_session_failed&details=${encodeURIComponent(sessionResult.error || 'unknown')}`);
    }
    
    // Set the session cookie and redirect to dashboard
    const response = NextResponse.redirect('/dashboard');
    const sessionId = sessionResult.user.sessionId;
    
    if (sessionId) {
      // Use AuthService to get cookie options for consistent settings
      const cookieOptions = authService.getSessionCookieOptions(undefined, request.headers);
      response.cookies.set('session', sessionId, cookieOptions.options);
      response.cookies.set('sessionId', sessionId, cookieOptions.options); // For compatibility
    } else {
      console.warn('No session ID returned from createOrGetUserSession for Twitter OAuth. User might not be fully logged in.');
    }
    
    return response;
    
  } catch (error) {
    console.error('Twitter OAuth callback error:', error);
    // Catch-all for unexpected errors
    return NextResponse.redirect(`/auth?error=twitter_oauth_callback_error&details=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}
