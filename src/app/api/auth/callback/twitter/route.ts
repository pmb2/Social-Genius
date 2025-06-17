import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    if (error) {
      return NextResponse.redirect('/auth?error=twitter_oauth_denied');
    }
    
    if (!code || !state) {
      return NextResponse.redirect('/auth?error=twitter_oauth_invalid');
    }
    
    // Verify state parameter
    const storedState = request.cookies.get('twitter_oauth_state')?.value;
    if (state !== storedState) {
      return NextResponse.redirect('/auth?error=twitter_oauth_state_mismatch');
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString('base64')}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.TWITTER_CLIENT_ID!,
        redirect_uri: process.env.TWITTER_REDIRECT_URI!,
        code_verifier: 'challenge'
      })
    });
    
    if (!tokenResponse.ok) {
      console.error('Twitter token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect('/auth?error=twitter_token_exchange_failed');
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!userResponse.ok) {
      console.error('Twitter user fetch failed:', await userResponse.text());
      return NextResponse.redirect('/auth?error=twitter_user_fetch_failed');
    }
    
    const twitterUser = await userResponse.json();
    
    // TODO: Create or login user in your database
    // For now, redirect to dashboard
    return NextResponse.redirect('/dashboard');
    
  } catch (error) {
    console.error('Twitter OAuth callback error:', error);
    return NextResponse.redirect('/auth?error=twitter_oauth_error');
  }
}
