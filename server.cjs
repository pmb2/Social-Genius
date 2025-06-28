// Express server for Next.js (CommonJS version)
const express = require('express');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
// Always bind to 0.0.0.0 to ensure the app is accessible externally
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting server with binding to ${hostname}:${port}, NODE_ENV=${process.env.NODE_ENV}`);
console.log(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL}, GOOGLE_REDIRECT_URI=${process.env.GOOGLE_REDIRECT_URI}`);

// Initialize Next.js
const app = next({ dev, dir: '.' });
const handle = app.getRequestHandler();

// Prepare the Next.js application
app.prepare()
  .then(() => {
    const server = express();
    
    // Log all requests for debugging
    server.use((req, res, next) => {
      if (req.path !== '/health' && req.path !== '/api/health') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      }
      next();
    });
    
    // Health check endpoint
    server.get('/health', (req, res) => {
      res.status(200).send('OK');
    });
    
    server.get('/api/health', (req, res) => {
      res.status(200).send('OK');
    });
    
    // Handle all other requests with Next.js
    server.get('*', (req, res) => {
      return handle(req, res);
    });
    
    server.post('*', (req, res) => {
      return handle(req, res);
    });
    
    server.put('*', (req, res) => {
      return handle(req, res);
    });
    
    server.delete('*', (req, res) => {
      return handle(req, res);
    });
    
    server.options('*', (req, res) => {
      return handle(req, res);
    });
    
    // Create HTTP server
    const httpServer = createServer(server);
    
    // Explicitly listen on all interfaces
    httpServer.listen(port, hostname, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Access via http://localhost:${port} or http://app.social-genius.com`);
      console.log(`> Environment: ${process.env.NODE_ENV}`);
      console.log(`> Auth URL: ${process.env.NEXTAUTH_URL || 'not set'}`);
      console.log(`> Google Redirect: ${process.env.GOOGLE_REDIRECT_URI || 'not set'}`);
    });
  })
  .catch((ex) => {
    console.error('An error occurred starting the server:');
    console.error(ex.stack);
    process.exit(1);
  });