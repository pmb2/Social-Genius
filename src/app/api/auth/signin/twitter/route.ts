import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const twitterClientId = process.env.TWITTER_CLIENT_ID;
    const twitterRedirectUri = process.env.TWITTER_REDIRECT_URI;
    
    if (!twitterClientId || !twitterRedirectUri) {
      return NextResponse.json(
        { error: 'Twitter OAuth not configured' }, 
        { status: 500 }
      );
    }

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15);
    
    // Store state in session/cookie for verification
    const response = NextResponse.redirect(
      `https://twitter.com/i/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${twitterClientId}&` +
      `redirect_uri=${encodeURIComponent(twitterRedirectUri)}&` +
      `scope=tweet.read%20users.read&` +
      `state=${state}&` +
      `code_challenge=challenge&` +
      `code_challenge_method=plain`
    );
    
    // Set state cookie for verification
    response.cookies.set('twitter_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('Twitter OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Twitter OAuth' }, 
      { status: 500 }
    );
  }
}
