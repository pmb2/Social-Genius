// This file is used to polyfill Node.js modules for browser compatibility
// It should be imported before any code that depends on Node.js modules

// Polyfill for 'fs' module
if (typeof window !== 'undefined') {
  window.fs = {
    existsSync: () => false,
    readFileSync: () => '',
    promises: {
      readFile: () => Promise.resolve('')
    }
  };
}

// Polyfill for 'path' module
if (typeof window !== 'undefined') {
  window.path = {
    join: (...args) => args.join('/'),
    resolve: (...args) => args.join('/'),
    dirname: (path) => path.split('/').slice(0, -1).join('/'),
    basename: (path) => path.split('/').pop()
  };
}

// Polyfill for 'process' module
if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {},
    cwd: () => '/',
    version: '',
    platform: 'browser',
    nextTick: (fn) => setTimeout(fn, 0)
  };
}

// Create a custom implementation of pg-connection-string for the browser
if (typeof window !== 'undefined') {
  window.pgConnectionString = {
    parse: (connectionString) => {
      const params = {};
      
      // Parse a PostgreSQL connection string into an object
      if (/^postgres(ql)?:\/\//i.test(connectionString)) {
        try {
          const url = new URL(connectionString);
          
          params.host = url.hostname;
          params.port = url.port ? parseInt(url.port, 10) : 5432;
          
          if (url.pathname && url.pathname.length > 1) {
            params.database = url.pathname.slice(1);
          }
          
          if (url.username) {
            params.user = decodeURIComponent(url.username);
          }
          
          if (url.password) {
            params.password = decodeURIComponent(url.password);
          }
          
          // Handle ssl parameter
          const sslParam = url.searchParams.get('ssl');
          if (sslParam === 'true' || sslParam === '1') {
            params.ssl = true;
          }
        } catch (e) {
          console.error('Failed to parse connection string:', e);
        }
      } else {
        // Parse key=value format
        connectionString.split(' ').forEach((pair) => {
          const parts = pair.split('=');
          if (parts.length === 2) {
            params[parts[0].trim()] = parts[1].trim().replace(/^['"]|['"]$/g, '');
          }
        });
      }
      
      return params;
    }
  };
  
  // Add a module patching function to handle imports
  const originalRequire = window.require;
  window.require = function(moduleName) {
    if (moduleName === 'pg-connection-string') {
      return window.pgConnectionString;
    }
    if (moduleName === 'fs') {
      return window.fs;
    }
    if (moduleName === 'path') {
      return window.path;
    }
    if (originalRequire) {
      return originalRequire(moduleName);
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };
}

console.log('Node.js polyfills loaded for browser environment');