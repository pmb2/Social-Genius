/**
 * This is a browser-compatible version of pg-connection-string
 * that doesn't rely on the 'fs' module
 */

export function parse(connectionString: string) {
  const params: any = {};
  let parsedUri;
  let ssl = false;

  // If connection string starts with postgres:// or postgresql://, parse as URI
  if (/^postgres(ql)?:\/\//i.test(connectionString)) {
    parsedUri = new URL(connectionString);
    params.host = parsedUri.hostname;
    params.port = parsedUri.port ? parseInt(parsedUri.port, 10) : 5432;
    
    if (parsedUri.pathname && parsedUri.pathname.length > 1) {
      params.database = parsedUri.pathname.slice(1);
    }
    
    if (parsedUri.username) {
      params.user = decodeURIComponent(parsedUri.username);
    }
    
    if (parsedUri.password) {
      params.password = decodeURIComponent(parsedUri.password);
    }

    // Parse query parameters
    const searchParams = parsedUri.searchParams;
    for (const [key, value] of searchParams.entries()) {
      if (key === 'ssl') {
        ssl = value === 'true' || value === '1';
        // Don't set params.ssl to the string value
        continue;
      }
      if (key === 'sslmode') {
        // Handle sslmode properly - don't convert it to boolean
        params[key] = value;
      } else {
        params[key] = value;
      }
    }
  } else {
    // Parse key-value pair format
    connectionString.split(' ').forEach(function(str) {
      const [key, value] = str.split('=');
      if (key && value) {
        const cleanKey = key.trim();
        const cleanValue = value.trim().replace(/^['"]|['"]$/g, '');
        
        if (cleanKey === 'ssl') {
          ssl = cleanValue === 'true' || cleanValue === '1';
          // Don't set params.ssl to the string value
          return;
        }
        
        params[cleanKey] = cleanValue;
      }
    });
  }

  if (ssl) {
    // Convert ssl=true to proper SSL object format for PostgreSQL
    params.ssl = { rejectUnauthorized: false };
  }

  return params;
}

const pgConnectionString = { parse };

export default pgConnectionString;