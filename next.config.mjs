/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't use rewrites for favicon as it can cause issues
  // Let Next.js handle favicon from the public directory normally
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      }
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Enable output standalone mode for Docker support
  output: 'standalone',
  // Add console logging for debug information
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Configure server-related options
  experimental: {
    // This is needed for NextAuth.js in the App Router
    serverComponentsExternalPackages: ["jose"]
  },
  // Disable security headers in development to avoid HTTP issues
  async headers() {
    return process.env.NODE_ENV === 'production' 
      ? [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ],
        },
      ]
      : [];
  },
  // Only enable HTTPS redirect in production
  async redirects() {
    return [
      process.env.NODE_ENV === 'production' 
        ? {
            source: '/:path*',
            has: [
              {
                type: 'header',
                key: 'x-forwarded-proto',
                value: 'http',
              },
            ],
            destination: 'https://:host/:path*',
            permanent: true,
          }
        : null,
    ].filter(Boolean);
  },
};

export default nextConfig;
