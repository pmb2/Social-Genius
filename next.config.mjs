/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/public/favicon.ico',
      },
    ]
  },
  
  // Disable telemetry
  
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

  transpilePackages: ['@auth/core', '@auth/react', 'src/lib/auth'],
  
  // Webpack configuration to handle Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        dns: false
      };
      config.externals.push({
        'playwright': 'var undefined',
        'playwright-core': 'var undefined'
      });
    }
    
    // Suppress source map warnings
    config.devtool = process.env.NODE_ENV === 'development' ? 'eval-source-map' : false;

    if (isServer) {
      config.externals.push('playwright-core', 'playwright');
    }
    
    return config;
  },
  
  // Suppress font preload warnings
  // optimizeFonts: false, // Temporarily disable to troubleshoot chunk loading


  // Development-specific settings
  // ...(process.env.NODE_ENV === 'development' && {
  //   logging: {
  //     fetches: {
  //       fullUrl: false,
  //     },
  //   },
  // }),

  experimental: {
    esmExternals: false, // To avoid issues with external ES modules
    
  },
};

export default nextConfig;
