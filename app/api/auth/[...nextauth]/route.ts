import { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { randomBytes, scryptSync } from 'crypto';
import PostgresService from '@/services/postgres-service';

// Specify that this route runs on the Node.js runtime, not Edge
export const runtime = 'nodejs';

// Utility functions for password hashing
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function comparePassword(password: string, storedHash: string): boolean {
  try {
    // Extract the salt and hash
    const [salt, hash] = storedHash.split(':');
    
    // Hash the password with the same salt
    const hashBuffer = scryptSync(password, salt, 64);
    const storedHashBuffer = Buffer.from(hash, 'hex');
    
    // Compare the hashes using timing-safe comparison
    return hashBuffer.length === storedHashBuffer.length && 
      Buffer.compare(hashBuffer, storedHashBuffer) === 0;
  } catch (err) {
    console.error('Error comparing passwords:', err);
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Get database instance
          const dbService = PostgresService.getInstance();
          
          // Get user by email
          const user = await dbService.getUserByEmail(credentials.email);
          
          if (!user) {
            console.log(`No user found with email: ${credentials.email}`);
            return null;
          }
          
          console.log('Found user:', { 
            id: user.id, 
            email: user.email, 
            hasPasswordHash: !!user.password_hash 
          });

          // Check password
          const isValidPassword = comparePassword(credentials.password, user.password_hash);
          
          if (!isValidPassword) {
            console.log(`Invalid password for user: ${credentials.email}`);
            return null;
          }
          
          // Update last login
          await dbService.updateLastLogin(user.id);
          
          // Return the user object
          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name || undefined,
            password: user.password_hash // Map password_hash to password for NextAuth
          };
        } catch (error) {
          console.error("Error in authorization:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If the user object is available, add it to the token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user information to session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };