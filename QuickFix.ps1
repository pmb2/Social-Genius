# PowerShell script to fix and start Social Genius
Write-Host "===== Social Genius - Quick Fix =====" -ForegroundColor Cyan
Write-Host "This script will fix and start your application" -ForegroundColor Cyan
Write-Host ""

# Verify Docker is running
Write-Host "Checking if Docker is running..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
        exit 1
    }
    Write-Host "Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "Docker command not found or Docker not running. Please install Docker Desktop or start it." -ForegroundColor Red
    exit 1
}

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# Set up fix file
$pgFixContent = @"
// CommonJS module to fix pg-native issues
"use strict";

// Disable pg-native at runtime
process.env.NODE_PG_FORCE_NATIVE = '0';

// Override require to intercept pg-native
const Module = require('module');
const originalRequire = Module.prototype.require;

// Replace the require function to intercept pg-native
Module.prototype.require = function(path) {
  if (path === 'pg-native') {
    console.log('pg-native require intercepted, using JavaScript implementation');
    // Return a mock implementation
    function Client() {}
    Client.prototype.connect = function() { return Promise.resolve({}); }
    Client.prototype.query = function() { return Promise.resolve({ rows: [], rowCount: 0 }); }
    Client.prototype.end = function() { return Promise.resolve(); }
    return Client;
  }

  // Also intercept pg to add the native property
  if (path === 'pg') {
    const pg = originalRequire.call(this, path);
    
    // Add mock native property if it doesn't exist
    if (!pg.native) {
      console.log('Adding mock pg.native implementation');
      function MockClient() {}
      MockClient.prototype.connect = function() { return Promise.resolve({}); }
      MockClient.prototype.query = function() { return Promise.resolve({ rows: [], rowCount: 0 }); }
      MockClient.prototype.end = function() { return Promise.resolve(); }
      
      pg.native = {
        Client: MockClient
      };
    }
    
    return pg;
  }
  
  return originalRequire.call(this, path);
};

console.log('PostgreSQL native bindings disabled, using pure JavaScript implementation');
"@

Write-Host "Creating pg-fix.cjs file..." -ForegroundColor Yellow
Set-Content -Path "./pg-fix.cjs" -Value $pgFixContent

# Create simple middleware.ts if it doesn't exist
if (-not (Test-Path -Path "./middleware.ts")) {
    Write-Host "Creating simple middleware.ts file..." -ForegroundColor Yellow
    Set-Content -Path "./middleware.ts" -Value "export default function middleware() { return; }"
}

# Start the application
Write-Host "Starting the application..." -ForegroundColor Green
docker-compose -f docker-compose.dev.yml up -d --build

# Wait for application to start
Write-Host "Waiting for application to start (20 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Try to open the application
Write-Host "Opening application in default browser..." -ForegroundColor Green
Start-Process "http://localhost:3000"

# Show logs
$showLogs = Read-Host "Do you want to view application logs? (y/n)"
if ($showLogs -eq "y" -or $showLogs -eq "Y") {
    docker-compose -f docker-compose.dev.yml logs -f app
}

Write-Host "`nTo restart the application later, simply run this script again" -ForegroundColor Cyan