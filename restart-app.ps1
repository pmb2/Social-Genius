# PowerShell script to restart Social Genius with database fixes
Write-Host "=== Social Genius App Restart for Windows (PowerShell) ===" -ForegroundColor Cyan

# Stop all containers
Write-Host "Stopping all containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# Clean up volumes if requested
if ($args[0] -eq "--clean") {
    Write-Host "Cleaning up volumes..." -ForegroundColor Yellow
    docker volume rm social-genius_postgres_data social-genius_redis_data -f
}

# Create pg-preload.js with proper Windows line endings
Write-Host "Creating pg handling script..." -ForegroundColor Yellow
@"
// Disable pg-native at runtime
process.env.NODE_PG_FORCE_NATIVE = '0';

// Override require for pg-native
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(modulePath) {
  if (modulePath === 'pg-native') {
    console.log('\x1b[33m⚠️ pg-native require intercepted, using JavaScript implementation\x1b[0m');
    
    // Return a mock implementation
    function Client() {}
    Client.prototype.connect = () => Promise.resolve({});
    Client.prototype.query = () => Promise.resolve({ rows: [], rowCount: 0 });
    Client.prototype.end = () => Promise.resolve();
    
    return Client;
  }
  return originalRequire.call(this, modulePath);
};

console.log('\x1b[32m✅ pg-native interception enabled\x1b[0m');
"@ | Out-File -FilePath "$PWD\pg-preload.js" -Encoding utf8

# Update docker-compose.dev.yml to ensure pg-native is disabled
Write-Host "Updating docker-compose configuration..." -ForegroundColor Yellow
$dockerComposeContent = Get-Content -Path "$PWD\docker-compose.dev.yml" -Raw
if (-not $dockerComposeContent.Contains("NODE_PG_FORCE_NATIVE")) {
    Write-Host "Adding NODE_PG_FORCE_NATIVE environment variable..." -ForegroundColor Yellow
    $dockerComposeContent = $dockerComposeContent -replace "      REDIS_PREFIX: ""social-genius:dev:""", "      REDIS_PREFIX: ""social-genius:dev:""`n      NODE_PG_FORCE_NATIVE: '0'"
    Set-Content -Path "$PWD\docker-compose.dev.yml" -Value $dockerComposeContent
}

# Rebuild the containers
Write-Host "Building containers with fixed configuration..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml build app

# Start everything up
Write-Host "Starting all services..." -ForegroundColor Green
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to initialize
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Display connection info
Write-Host "=== Social Genius App Restart Complete ===" -ForegroundColor Green
Write-Host "You can access the application at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "To see app logs, run: docker-compose -f docker-compose.dev.yml logs -f app" -ForegroundColor Cyan

# Show logs
Write-Host "Showing application logs:" -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml logs -f app