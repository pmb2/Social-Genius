import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import InitDbScript from './init-db-script';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SocialGenius - Social Media Management",
  description: "Login to your SocialGenius account",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Database initialization script - runs once at startup */}
        <InitDbScript />
        
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
