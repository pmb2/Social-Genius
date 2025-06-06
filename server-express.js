// Express server for Next.js using ESM syntax
import express from 'express';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
// Always bind to 0.0.0.0 to ensure the app is accessible externally
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server with binding to ${hostname}:${port}, NODE_ENV=${process.env.NODE_ENV}`);
console.log(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL}, GOOGLE_REDIRECT_URI=${process.env.GOOGLE_REDIRECT_URI}`);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  
  // Health check endpoint
  server.get('/health', (req, res) => {
    res.status(200).send('OK');
  });
  
  // Handle all other requests with Next.js
  server.all('*', (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  // Explicitly listen on all interfaces
  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Access via http://localhost:${port} or http://app.social-genius.com`);
    console.log(`> Environment: ${process.env.NODE_ENV}`);
    console.log(`> Auth URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
    console.log(`> Google Redirect: ${process.env.GOOGLE_REDIRECT_URI || 'not set'}`);
  });
});