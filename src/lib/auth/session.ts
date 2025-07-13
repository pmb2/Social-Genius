import { IronSessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

export interface SessionData {
    id: number;
    isLoggedIn: boolean;
    codeVerifier?: string;
}

declare module 'iron-session' {
    interface IronSessionData extends SessionData {}
}

export const sessionOptions = {
  password: process.env.IRON_SESSION_SECRET as string,
  cookieName: 'social_genius_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  },
};

console.log('IRON_SESSION_SECRET (first 5 chars):', process.env.IRON_SESSION_SECRET?.substring(0, 5));

export function getSession() {
    return getIronSession<SessionData>(cookies(), sessionOptions);
}