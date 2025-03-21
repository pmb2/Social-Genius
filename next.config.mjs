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
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600, // Increased cache TTL to 1 hour
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // COMPLETELY disable image optimization when using Bun to avoid worker_threads errors
    unoptimized: true,
  },
  // Use standalone output for better performance
  output: 'standalone',
  // Enable memory cache
  staticPageGenerationTimeout: 180, // 3 minutes timeout for static generation
  reactStrictMode: true, // Helps catch bugs early
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // Remove console logs in production
  },
  // Add console logging for debug information
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  // Configure server-related options
  experimental: {
    // This is needed for NextAuth.js in the App Router
    serverComponentsExternalPackages: ["jose", "playwright", "playwright-core"],
    // Enable optimizations
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Disable worker-based features when using Bun
    memoryBasedWorkersCount: process.env.USE_BUN !== 'true',
    // More efficient bundling
    optimisticClientCache: true,
    // Disable worker pools with Bun
    workerThreads: process.env.USE_BUN !== 'true',
    // Disable turbotrace with Bun
    turbotrace: process.env.USE_BUN !== 'true',
  },
  // Add webpack configuration for Node.js modules
  webpack: (config, { dev, isServer }) => {
    // For Playwright/browser automation in Next.js
    if (!isServer) {
      // Handle Node.js modules in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        util: false,
        net: false,
        tls: false,
        crypto: false,
        http: false,
        https: false,
        dns: false,
        child_process: false,
        os: false,
        inspector: false,
        readline: false,
        tty: false,
        zlib: false,
        stream: false,
        buffer: false,
        events: false,
        process: false,
      };
      
      // Ignore specific modules in browser builds
      config.module.rules.push({
        test: /playwright|playwright-core|@playwright/,
        use: 'null-loader',
      });
      
      // Fix chunk loading errors in Bun environment
      if (process.env.USE_BUN === 'true') {
        // Use a simpler chunking strategy for Bun
        config.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Bundle all core dependencies together
            framework: {
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              chunks: 'all',
            },
            // Single commons chunk
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            // Bundle larger modules separately
            lib: {
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              name(module) {
                // Get simplified lib name
                const match = module.context && module.context.match(/[\\/]node_modules[\\/](.*?)(?:[\\/]|$)/);
                const name = match && match[1] ? match[1] : 'vendor';
                return `npm.${name.replace('@', '')}`;
              },
              minSize: 50000,
            }
          },
        };

        // Limit number of parallel requests for chunks
        config.output.chunkLoadingGlobal = 'webpackChunkDist';
        config.output.chunkLoading = 'jsonp';
        config.output.chunkFormat = 'array-push';
      } else {
        // Use regular optimization for non-Bun environments
        config.optimization.splitChunks = {
          chunks: 'all',
          maxInitialRequests: Infinity,
          minSize: 20000,
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                // Get the package name
                const match = module.context && module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
                const packageName = match ? match[1] : '';
                // Return a clean package name
                return `npm.${packageName.replace('@', '')}`;
              },
            },
          },
        };
      }
    }
    
    // Enable source maps in development but use faster options
    if (process.env.NODE_ENV === 'development') {
      config.devtool = 'eval-source-map';
    }
    
    // Add tree shaking hint
    config.module.rules.push({
      test: /\.(js|mjs|jsx|ts|tsx)$/,
      sideEffects: false,
    });
    
    return config;
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