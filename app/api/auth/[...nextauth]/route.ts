import NextAuth, { AuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { AuthService } from '@/services/auth';
import { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from "next";

export const runtime = 'nodejs';

export function generateStaticParams() {
  return []
}

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const authService = AuthService.getInstance();
        const result = await authService.login(credentials.email, credentials.password);

        if (result.success && result.user) {
          return {
            id: result.user.id.toString(),
            email: result.user.email,
            name: result.user.name,
          };
        } else {
          return null;
        }
      }
    })
  ],

  secret: process.env.NEXTAUTH_SECRET || 'a-secure-default-secret-for-development',

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth',
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);



export { handler as GET, handler as POST };

