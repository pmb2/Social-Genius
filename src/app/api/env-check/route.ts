import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Get masked environment variables for debugging
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? 
        `${process.env.DATABASE_URL.substring(0, 9)}...${process.env.DATABASE_URL.substring(process.env.DATABASE_URL.length - 10)}` : 
        'not set',
      DATABASE_URL_LENGTH: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
      HAS_JWT_SECRET: !!process.env.JWT_SECRET,
      OPENAI_API_KEY_PREFIX: process.env.OPENAI_API_KEY ? 
        process.env.OPENAI_API_KEY.substring(0, 7) : 
        'not set'
    };
    
    return NextResponse.json({
      env: envInfo
    });
  } catch (error) {
    console.error('Error checking environment:', error);
    return NextResponse.json(
      { error: 'Error retrieving environment information' },
      { status: 500 }
    );
  }
}