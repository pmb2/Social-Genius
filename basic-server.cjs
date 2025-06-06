// Basic HTTP server for testing
const express = require('express');
const app = express();
const port = 3000;

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Social Genius - Maintenance Mode</title>
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
            <h2>Maintenance Mode</h2>
            <p>The site is currently in maintenance mode. We are fixing path-to-regexp issues in the server.</p>
            <p>We'll be back online shortly!</p>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Catch-all route for any other path
app.get('*', (req, res) => {
  res.send('Page not available during maintenance mode');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Basic maintenance server running on http://0.0.0.0:${port}`);
  console.log('Server address:', require('os').networkInterfaces());
});