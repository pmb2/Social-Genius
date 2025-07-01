import { IronSessionOptions } from 'iron-session';

export interface SessionData {
    id: number;
    isLoggedIn: boolean;
}

declare module 'iron-session' {
    interface IronSessionData extends SessionData {}
}

export const sessionOptions: IronSessionOptions = {
    cookieName: 'social_genius_session',
    password: process.env.IRON_SESSION_SECRET as string,
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
    },
};
