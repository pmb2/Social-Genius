// Custom Next.js server with Express (CommonJS version)
const express = require('express');
const http = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
// Always bind to 0.0.0.0 to ensure the app is accessible externally
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting custom server with binding to ${hostname}:${port}, NODE_ENV=${process.env.NODE_ENV}`);
console.log(`NEXTAUTH_URL=${process.env.NEXTAUTH_URL}, GOOGLE_REDIRECT_URI=${process.env.GOOGLE_REDIRECT_URI}`);

// Initialize Next.js
const app = next({ dev, dir: '.' });
const handle = app.getRequestHandler();

// Prepare the Next.js application
app.prepare()
  .then(() => {
    const server = express();
    
    // Health check endpoint
    server.get('/health', (req, res) => {
      res.status(200).send('OK');
    });
    
    server.get('/api/health', (req, res) => {
      res.status(200).send('OK');
    });
    
    // Handle all other requests with Next.js
    server.all('*', (req, res) => {
      return handle(req, res);
    });
    
    // Create HTTP server
    const httpServer = http.createServer(server);
    
    // Explicitly listen on all interfaces
    httpServer.listen(port, hostname, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Access via http://localhost:${port}`);
      console.log(`> Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((ex) => {
    console.error('An error occurred starting the server:');
    console.error(ex.stack);
    process.exit(1);
  });