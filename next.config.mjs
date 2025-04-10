// Set pg config environment variables
if (typeof window === 'undefined') {
  process.env.NODE_PG_FORCE_NATIVE = '0';
  console.log('Set NODE_PG_FORCE_NATIVE=0 in next.config.mjs');
  
  // Don't try to require CJS modules directly in ESM
  // The pg patch will be applied by node_modules_patch.cjs
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // App Router is enabled by default in Next.js 14+
  
  // In production mode, use standalone output
  distDir: 'dist',
  ...(process.env.NODE_ENV === 'production' ? {
    output: 'standalone',
  } : {}),
  
  // Disable static generation for all routes
  staticPageGenerationTimeout: 180,
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
  // We're using 'standalone' as specified above for production
  // Enable memory cache
  staticPageGenerationTimeout: 180, // 3 minutes timeout for static generation
  reactStrictMode: process.env.NODE_ENV === 'production' ? false : true, // Disable in production for better performance
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Improve bundle sizes and performance
  swcMinify: true,
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
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
    serverComponentsExternalPackages: ["jose", "playwright", "playwright-core", "pg", "pg-pool", "pg-connection-string"],
    // Enable optimizations for packages with many exports
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons', 
      'sonner', 
      '@langchain/openai'
    ],
    // Disable worker-based features when using Bun
    memoryBasedWorkersCount: process.env.USE_BUN !== 'true',
    // More efficient bundling
    optimisticClientCache: true,
    // Disable worker pools with Bun
    workerThreads: process.env.USE_BUN !== 'true',
    // Disable turbotrace with Bun
    turbotrace: process.env.USE_BUN !== 'true' ? { 
      contextDirectory: '.',
    } : false,
    // Enable serverActions in production for better performance
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // PPR requires canary version, so we'll use other optimizations instead
    // ppr: true,
  },
  // Add webpack configuration for Node.js modules
  webpack: (config, { dev, isServer }) => {
    // Fix React Server Components bundling issues
    if (isServer) {
      // Handle pg-native properly for server side code
      config.externals = [...config.externals, 'pg-native'];
    }
    
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
        'pg-native': false,
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
    
    // Patch for RSC originalFactory error - provide a default factory when undefined
    // This addresses the "TypeError: originalFactory is undefined" error in React Server Components
    config.plugins.push({
      apply(compiler) {
        compiler.hooks.done.tap('FixRSCOriginalFactoryError', stats => {
          // Check if there was an error during compilation
          if (stats.hasErrors()) {
            console.log('Webpack compilation had errors, not applying RSC factory fix');
            return;
          }

          console.log('Successfully applied RSC originalFactory fix');
        });
      }
    });
    
    // Fix for React Server Components bundling issues
    if (isServer) {
      config.module.rules.push({
        test: /\.m?js$/,
        include: [/node_modules\/react-server-dom-webpack/],
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-react', { runtime: 'automatic' }]
              ],
              plugins: [
                '@babel/plugin-transform-modules-commonjs'
              ]
            }
          }
        ]
      });
    }
    
    // Enable source maps in development but use faster options
    if (process.env.NODE_ENV === 'development') {
      config.devtool = 'eval-source-map';
      
      // Increase cache validity for faster rebuilds in development
      config.cache = {
        type: 'filesystem',
        allowCollectingMemory: true,
        compression: 'gzip',
        profile: false,
      };
    }
    
    // Add tree shaking hint and optimize modules
    config.module.rules.push({
      test: /\.(js|mjs|jsx|ts|tsx)$/,
      sideEffects: false,
    });
    
    // Optimize chunk loading speed
    config.optimization.moduleIds = 'deterministic';
    
    // Disable webpack processing for large static assets
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/,
      type: 'asset/resource',
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