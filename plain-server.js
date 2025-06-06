// Simple HTTP server for Next.js
const http = require('http');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
// Always bind to 0.0.0.0 to ensure external accessibility
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
    // Create a simple HTTP server
    http.createServer((req, res) => {
      // Handle health check endpoints directly
      if (req.url === '/health' || req.url === '/api/health') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('OK');
        return;
      }
      
      // For all other requests, use Next.js request handler
      return handle(req, res);
    }).listen(port, hostname, (err) => {
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