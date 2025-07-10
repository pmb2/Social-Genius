import { getIronSession, IronSessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
    id: number;
    isLoggedIn: boolean;
    codeVerifier?: string;
}

declare module 'iron-session' {
    interface IronSessionData extends SessionData {}
}

export const sessionOptions: IronSessionOptions = {
    cookieName: 'social_genius_session',
    password: process.env.IRON_SESSION_SECRET as string,
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        domain: undefined,
    },
};

export function getSession() {
    return getIronSession<SessionData>(cookies(), sessionOptions);
}