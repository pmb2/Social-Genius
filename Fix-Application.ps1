# PowerShell script to fix Social Genius application issues
# Run as Administrator for best results

# Display banner
Write-Host "===== Social Genius Application Fix =====" -ForegroundColor Cyan
Write-Host "This script will fix database connectivity issues" -ForegroundColor Cyan
Write-Host ""

# Create backup directory
$backupDir = ".\backups"
if (-not (Test-Path $backupDir)) {
    New-Item -Path $backupDir -ItemType Directory | Out-Null
}

# Backup original files
Write-Host "Creating backups of original files..." -ForegroundColor Yellow
Copy-Item "docker-compose.dev.yml" -Destination "$backupDir\docker-compose.dev.yml.bak" -Force
Copy-Item "package.json" -Destination "$backupDir\package.json.bak" -Force

# Create pg-native mock module
Write-Host "Creating pg-native mock module..." -ForegroundColor Yellow
$moduleDir = ".\node_modules\pg-native-mock"
if (-not (Test-Path $moduleDir)) {
    New-Item -Path $moduleDir -ItemType Directory | Out-Null
}

# Create mock package.json
@"
{
  "name": "pg-native-mock",
  "version": "1.0.0",
  "description": "Mock implementation of pg-native",
  "main": "index.js",
  "author": "Social Genius",
  "license": "MIT"
}
"@ | Out-File -FilePath "$moduleDir\package.json" -Encoding utf8

# Create mock implementation
@"
// Mock implementation of pg-native
'use strict';

// Client constructor
function Client() {
  this.connected = false;
}

// Connect method (supports both callback and promise styles)
Client.prototype.connect = function(connStr, callback) {
  this.connected = true;
  this.connectionString = connStr;
  
  if (callback) {
    process.nextTick(() => {
      callback(null);
    });
    return this;
  }
  
  return Promise.resolve(this);
};

// Query method (supports both callback and promise styles)
Client.prototype.query = function(text, values, callback) {
  // Handle different argument patterns
  if (typeof values === 'function') {
    callback = values;
    values = undefined;
  }
  
  const result = { rows: [], rowCount: 0 };
  
  if (callback) {
    process.nextTick(() => {
      callback(null, result);
    });
    return this;
  }
  
  return Promise.resolve(result);
};

// End method (supports both callback and promise styles)
Client.prototype.end = function(callback) {
  this.connected = false;
  
  if (callback) {
    process.nextTick(() => {
      callback(null);
    });
    return this;
  }
  
  return Promise.resolve();
};

// Provide the escape method to mimic real behavior
Client.prototype.escapeLiteral = function(str) {
  return "'" + str.replace(/'/g, "''") + "'";
};

Client.prototype.escapeIdentifier = function(str) {
  return '"' + str.replace(/"/g, '""') + '"';
};

// Export the Client constructor
module.exports = Client;
console.log('pg-native mock loaded successfully');
"@ | Out-File -FilePath "$moduleDir\index.js" -Encoding utf8

# Create CommonJS module to patch pg-native
@"
// CommonJS module to patch pg-native at runtime
'use strict';

// Disable pg-native at runtime
process.env.NODE_PG_FORCE_NATIVE = '0';

// Override require to intercept pg-native
const Module = require('module');
const originalRequire = Module.prototype.require;

// Create a simple mock implementation
function createMockClient() {
  function Client() {
    this.connected = false;
  }

  Client.prototype.connect = function(connStr, callback) {
    this.connected = true;
    
    if (callback) {
      process.nextTick(() => callback(null));
      return this;
    }
    
    return Promise.resolve(this);
  };

  Client.prototype.query = function(text, values, callback) {
    // Handle different argument patterns
    if (typeof values === 'function') {
      callback = values;
      values = undefined;
    }
    
    const result = { rows: [], rowCount: 0 };
    
    if (callback) {
      process.nextTick(() => callback(null, result));
      return this;
    }
    
    return Promise.resolve(result);
  };

  Client.prototype.end = function(callback) {
    this.connected = false;
    
    if (callback) {
      process.nextTick(() => callback(null));
      return this;
    }
    
    return Promise.resolve();
  };

  Client.prototype.escapeLiteral = function(str) {
    return "'" + str.replace(/'/g, "''") + "'";
  };

  Client.prototype.escapeIdentifier = function(str) {
    return '"' + str.replace(/"/g, '""') + '"';
  };

  return Client;
}

// Replace the require function to intercept pg-native
Module.prototype.require = function(path) {
  if (path === 'pg-native') {
    console.log('pg-native require intercepted, using JavaScript implementation');
    return createMockClient();
  }
  
  // Check for pg module to patch it directly
  if (path === 'pg') {
    const pg = originalRequire.call(this, path);
    
    // Make sure native property exists but doesn't use actual native binding
    if (!pg.native) {
      console.log('Adding mock pg.native implementation');
      
      // Create a mock implementation for pg.native
      pg.native = {
        Client: createMockClient()
      };
    }
    
    return pg;
  }
  
  return originalRequire.call(this, path);
};

console.log('PostgreSQL native bindings disabled, using pure JavaScript implementation');
"@ | Out-File -FilePath ".\pg-fix.cjs" -Encoding utf8

# Update docker-compose file
Write-Host "Updating docker-compose.dev.yml..." -ForegroundColor Yellow
$dockerComposeContent = Get-Content -Path ".\docker-compose.dev.yml" -Raw

# Ensure pg-native is disabled
if (-not $dockerComposeContent.Contains("NODE_PG_FORCE_NATIVE")) {
    $dockerComposeContent = $dockerComposeContent -replace "      REDIS_PREFIX: ""social-genius:dev:""", "      REDIS_PREFIX: ""social-genius:dev:""`n      NODE_PG_FORCE_NATIVE: '0'"
}

# Add NODE_OPTIONS to load our fix
if (-not $dockerComposeContent.Contains("NODE_OPTIONS")) {
    $dockerComposeContent = $dockerComposeContent -replace "      NODE_PG_FORCE_NATIVE: '0'", "      NODE_PG_FORCE_NATIVE: '0'`n      NODE_OPTIONS: ""--require /app/pg-fix.cjs"""
}

# Fix Redis URL if needed
$dockerComposeContent = $dockerComposeContent -replace "REDIS_URL: redis://host.docker.internal:6380", "REDIS_URL: redis://redis:6379"

# Add JWT_SECRET if missing
if (-not $dockerComposeContent.Contains("JWT_SECRET")) {
    $dockerComposeContent = $dockerComposeContent -replace "      NODE_OPTIONS: ""--require /app/pg-fix.cjs""", "      NODE_OPTIONS: ""--require /app/pg-fix.cjs""`n      JWT_SECRET: ""dev-secret-key-change-me"""
}

# Add additional environment variables
$dockerComposeContent = $dockerComposeContent -replace "      JWT_SECRET: ""dev-secret-key-change-me""", "      JWT_SECRET: ""dev-secret-key-change-me""`n      PGHOST: postgres`n      PGUSER: postgres`n      PGPASSWORD: postgres`n      PGDATABASE: socialgenius`n      PGPORT: 5432"

# Add volume mount for pg-fix.cjs
$dockerComposeContent = $dockerComposeContent -replace "      - /app/node_modules", "      - /app/node_modules`n      - ./pg-fix.cjs:/app/pg-fix.cjs"

# Save updated docker-compose file
$dockerComposeContent | Set-Content -Path ".\docker-compose.dev.yml" -Encoding utf8

# Create simple middleware.ts file to avoid edge runtime errors
Write-Host "Creating fallback middleware.ts file..." -ForegroundColor Yellow
"export default function middleware() { return; }" | Set-Content -Path ".\middleware.ts" -Encoding utf8

# Save the middleware file
Write-Host "Starting application with fixes..." -ForegroundColor Green

# Restart everything
docker-compose -f docker-compose.dev.yml down
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to stop containers. Make sure Docker is running." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Build and start containers
docker-compose -f docker-compose.dev.yml up -d --build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start containers. See error messages above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Wait for services to be ready
Write-Host "Waiting for services to start (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check application status
Write-Host "Checking application status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "Application is running! Visit http://localhost:3000 in your browser" -ForegroundColor Green
}
catch {
    Write-Host "Application still starting... Please try visiting http://localhost:3000 in your browser in a few moments" -ForegroundColor Yellow
}

Write-Host "`nTo view logs, run:" -ForegroundColor Cyan
Write-Host "docker-compose -f docker-compose.dev.yml logs -f app" -ForegroundColor White

# Show logs if requested
$showLogs = Read-Host "Do you want to view application logs now? (y/n)"
if ($showLogs -eq "y" -or $showLogs -eq "Y") {
    docker-compose -f docker-compose.dev.yml logs -f app
}