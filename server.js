// Simple HTTP server for Next.js
const http = require('http');
const { createReadStream } = require('fs');
const { join } = require('path');

// Always bind to 0.0.0.0 to ensure external accessibility
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting simple server on port ${port}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Static HTML for health checks
const healthHtml = 'OK';

// Create a basic HTTP server
const server = http.createServer((req, res) => {
  // Log all requests except health checks
  if (req.url !== '/health' && req.url !== '/api/health') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  }

  // Simple router
  if (req.url === '/health' || req.url === '/api/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(healthHtml);
    return;
  }

  // For all other routes, serve the placeholder
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Social Genius - Maintenance</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 800px; margin: 0 auto; }
          h1 { color: #333; }
          .message { margin: 20px 0; padding: 20px; background: #f9f9f9; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Social Genius</h1>
          <div class="message">
            <h2>Site Maintenance</h2>
            <p>We're performing scheduled maintenance. We'll be back shortly!</p>
            <p>Server is responding correctly - this is a temporary maintenance page.</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Start the server on all interfaces (0.0.0.0)
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}/`);
});

// Handle errors
server.on('error', (e) => {
  console.error('Server error:', e);
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use!`);
  }
});
