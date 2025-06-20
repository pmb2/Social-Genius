/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable SES lockdown in development to prevent warnings
  experimental: {
    esmExternals: 'loose',
  },
  
  // Disable telemetry
  telemetry: false,
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
      },
    ],
    // Add image optimization settings
    formats: ['image/webp', 'image/avif'],
  },
  
  // Webpack configuration to handle Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }
    
    // Suppress source map warnings
    config.devtool = process.env.NODE_ENV === 'development' ? 'eval-source-map' : false;
    
    return config;
  },
  
  // Suppress font preload warnings
  optimizeFonts: true,
  
  // Development-specific settings
  ...(process.env.NODE_ENV === 'development' && {
    logging: {
      fetches: {
        fullUrl: false,
      },
    },
  }),
};

module.exports = nextConfig;
