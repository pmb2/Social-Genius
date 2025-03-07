import { AuthOptions } from "next-auth";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import PostgresService from '@/services/postgres-service';
import AuthService from '@/services/auth-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "Enter your email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.log("Missing credentials");
            return null;
          }

          // Use our existing AuthService for login
          const authService = AuthService.getInstance();
          const result = await authService.login(credentials.email, credentials.password);
          
          if (!result.success) {
            console.log(`Login failed for ${credentials.email}: ${result.error}`);
            return null;
          }
          
          // Return the user object for NextAuth
          return {
            id: result.user.id.toString(),
            email: result.user.email,
            name: result.user.name || undefined
          };
        } catch (error) {
          console.error("Error in authorize:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If the user object is available (right after signing in)
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user info to session from token
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string || "";
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth',
    signOut: '/auth',
    error: '/auth',
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "social-genius-auth-secret",
};

// Create and export the handler
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };