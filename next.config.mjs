/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      }
    ],
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
  // Redirect all HTTP traffic to HTTPS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  // Force HTTP to HTTPS redirect
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
