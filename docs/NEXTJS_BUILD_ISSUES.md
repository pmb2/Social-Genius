# Next.js Build Issues and Solutions

This document tracks common build issues encountered in the Social Genius project and their solutions.

## Module Not Found: Can't resolve 'fs' in pg-connection-string

### Problem
Next.js client-side code can't access Node.js modules like 'fs' directly, which causes errors when using packages like pg-connection-string that depend on these modules.

### Error Message
```
Module not found: Can't resolve 'fs'
Import trace for requested module:
./node_modules/pg/lib/connection-parameters.js
./node_modules/pg/lib/client.js
./node_modules/pg/lib/index.js
./services/postgres-service.ts
```

### Solution
1. Add browser polyfills in the webpack configuration:

```javascript
// next.config.js
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: require.resolve('browserify-fs'),
      path: require.resolve('path-browserify'),
      // Add other Node.js modules as needed
    };
  }
  return config;
}
```

2. Install the required polyfills:
```bash
npm install --save-dev browserify-fs path-browserify util crypto-browserify stream-browserify buffer events process
```

3. For Docker builds, ensure these dependencies are installed in the Dockerfile:
```docker
RUN npm install --save-dev browserify-fs path-browserify util crypto-browserify stream-browserify buffer events process
```

## Helcim Integration Issues

### Problem
The npm package 'helcim-js-sdk' doesn't exist in the npm registry.

### Error Message
```
npm error 404 Not Found - GET https://registry.npmjs.org/helcim-js-sdk - Not found
npm error 404  'helcim-js-sdk@^1.0.0' is not in this registry.
```

### Solution
1. Remove the non-existent package from package.json:
```diff
- "helcim-js-sdk": "^1.0.0",
```

2. Use Axios directly to make API calls to Helcim:
```typescript
// services/payment-service.ts
import axios from 'axios';

const getApiConfig = () => {
  const apiKey = process.env.HELCIM_API_KEY;
  const accountId = process.env.HELCIM_ACCOUNT_ID;
  const baseURL = process.env.HELCIM_ENVIRONMENT === 'production'
    ? 'https://api.helcim.com/v2'
    : 'https://api.helcim.com/v2/test';

  return {
    baseURL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Account-Id': accountId
    }
  };
};
```

## Cache Corruption

### Problem
Next.js cache files can become corrupted causing "Unexpected end of JSON input" errors.

### Error Message
```
SyntaxError: Unexpected end of JSON input
at JSON.parse (<anonymous>)
at loadManifest (/app/node_modules/next/dist/server/load-manifest.js:36:25)
```

### Solution
1. Clear the Next.js build cache:
```bash
# For local development
rm -rf .next

# For Docker deployments
docker-compose down
docker-compose up -d --build
```

2. Set `"distDir": "dist"` in next.config.js to isolate production builds from development.

## Environment Variable Issues

### Problem
Environment variables aren't being properly passed to Docker containers.

### Solution
1. Ensure environment variables are explicitly copied to .env.local in Dockerfile:
```docker
RUN echo "HELCIM_API_KEY=$HELCIM_API_KEY" >> .env.local
RUN echo "HELCIM_ACCOUNT_ID=$HELCIM_ACCOUNT_ID" >> .env.local
RUN echo "HELCIM_ENVIRONMENT=$HELCIM_ENVIRONMENT" >> .env.local
RUN echo "HELCIM_WEBHOOK_SECRET=$HELCIM_WEBHOOK_SECRET" >> .env.local
```

2. Pass environment variables in docker-compose.yml:
```yaml
environment:
  - HELCIM_API_KEY=${HELCIM_API_KEY}
  - HELCIM_ACCOUNT_ID=${HELCIM_ACCOUNT_ID}
  - HELCIM_ENVIRONMENT=${HELCIM_ENVIRONMENT}
  - HELCIM_WEBHOOK_SECRET=${HELCIM_WEBHOOK_SECRET}
```