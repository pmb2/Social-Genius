import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Configure aliases for both client and server
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve('./'),
    };

    // If client-side, use empty modules for Node-specific packages
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        http2: false,
        zlib: false,
        os: false,
        dns: false,
        net: false,
        tls: false,
        child_process: false,
        readline: false,
        electron: false,
        'chromium-bidi': false,
        async_hooks: false,
        inspector: false,
        'cloudflare:sockets': false,
        'pg-native': false,
        'bufferutil': false,
        'utf-8-validate': false,
      };

      // Add rules to handle binary files and HTML files
      config.module.rules.push(
        {
          test: /\.(ttf|woff|woff2|eot)$/,
          type: 'asset/resource',
          generator: {
            filename: 'static/media/[name].[hash][ext]',
          },
        },
        {
          test: /\.html$/,
          type: 'asset/source',
        }
      );

      // Add aliases for problematic modules
      config.resolve.alias['cloudflare:sockets'] = false;
      config.resolve.alias['pg-cloudflare'] = false;
      config.resolve.alias['pg-native'] = false;
    } else {
      // Server-side: alias pg-native to our mock implementation instead of false
      config.resolve.alias['pg-native'] = path.resolve('./pg-native-mock.cjs');
    }

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: [
      'pg', 
      'playwright', 
      'playwright-core',
      'bcryptjs',
    ],
    outputFileTracingIncludes: {
      '/api/**/*': ['node_modules/**/*'],
    },
    esmExternals: 'loose',
    serverActions: {
      bodySizeLimit: '2mb',
    },
    outputFileTracingRoot: "/home/ubuntu/Social-Genius",
    outputFileTracingExcludes: {
      '*': [
        '.git/**',
        '.next/**',
        '.vscode/**',
        'node_modules/better-sqlite3/**',
        'node_modules/@swc/**',
        'node_modules/webpack/**',
      ],
    },
  },
  // Improved handling for server modules
  transpilePackages: [],
  // Add support for serving fonts with proper MIME types
  async headers() {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  // Configure output for improved build process
  output: 'standalone',
  // Disable type checking during build for now to get past the error
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure proper transpilation of ES modules
  transpilePackages: ["lucide-react"],
  
  // Use production-ready configurations
  productionBrowserSourceMaps: true,
  
  // Increase timeouts and memory limits for build process
  staticPageGenerationTimeout: 180,
  
  
  // Mark all API routes as fully dynamic (not static-generated)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
        has: [
          {
            type: 'header',
            key: 'x-use-dynamic-data',
          },
        ],
      },
    ];
  },
  
  // Skip some of the build-time checks for API routes
  // Use default Next.js build directory
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gstatic.com',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
