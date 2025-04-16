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
      }
      params[key] = value;
    }
  } else {
    // Parse key-value pair format
    connectionString.split(' ').forEach(function(str) {
      const [key, value] = str.split('=');
      if (key && value) {
        params[key.trim()] = value.trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }

  if (ssl) {
    params.ssl = ssl;
  }

  return params;
}

export default { parse };