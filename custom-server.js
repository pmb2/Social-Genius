// custom-server.js
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
// In development, use localhost if specified in the HOST env var, otherwise use 0.0.0.0
// In production, always use 0.0.0.0 to bind to all interfaces
const hostname = process.env.NODE_ENV === 'production' 
  ? '0.0.0.0' 
  : (process.env.HOST || 'localhost');
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server with hostname: ${hostname}, port: ${port}, env: ${process.env.NODE_ENV}`);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Parse URL
      const parsedUrl = parse(req.url, true);
      
      // Let Next.js handle the request
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    
    // Log server startup
    console.log(`> Ready on http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
    console.log(`> NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
    console.log(`> Google Redirect: ${process.env.GOOGLE_REDIRECT_URI || 'not set'}`);
  });
});