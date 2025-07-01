# PowerShell script for rebuilding Social Genius in development mode

# Project name for container naming
$PROJECT_NAME = "social-genius"

Write-Host "Rebuilding Social Genius in development mode..." -ForegroundColor Yellow

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Stop existing containers but preserve volumes for database persistence
Write-Host "Stopping all existing containers but preserving database volumes..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down --remove-orphans

# Remove any stale networks
Write-Host "Removing any stale Docker networks..." -ForegroundColor Yellow
docker network prune -f

# Stop and remove any leftover containers with similar names
Write-Host "Removing any leftover containers..." -ForegroundColor Yellow
$containers = docker ps -a | Select-String -Pattern "social.*genius|pgadmin|postgres"
foreach ($container in $containers) {
    $containerId = $container.ToString().Split(' ')[0]
    if ($containerId) {
        Write-Host "Removing container $containerId"
        docker rm -f $containerId
    }
}

# Check for port conflicts
Write-Host "Checking for port conflicts..." -ForegroundColor Yellow
$ports = @(3001, 5050, 5432)
foreach ($port in $ports) {
    Write-Host "Checking port $port..." -ForegroundColor Yellow
    
    # Find processes using our ports (Windows version)
    $netstatOutput = netstat -ano | Select-String -Pattern ":$port "
    foreach ($line in $netstatOutput) {
        $process = $line.ToString().Split(' ')[-1]
        if ($process) {
            Write-Host "Killing process $process using port $port..." -ForegroundColor Yellow
            taskkill /F /PID $process 2>$null
        }
    }
    
    # Stop any Docker containers using this port
    Write-Host "Attempting to stop any Docker containers using port $port..." -ForegroundColor Yellow
    $containers = docker ps -q --filter "publish=$port"
    foreach ($container in $containers) {
        docker stop $container
    }
    
    # Wait a moment for the port to be fully released
    Start-Sleep -Seconds 2
}

# Apply database connection fixes
Write-Host "Applying database connection fixes..." -ForegroundColor Yellow
# Copy fixed postgres service to the active service
Copy-Item -Path "services\postgres-service-fixed.ts" -Destination "services\postgres-service.ts" -Force
Write-Host "Database service fixed applied." -ForegroundColor Green

# Clean up any previous builds
Write-Host "Cleaning up previous builds..." -ForegroundColor Yellow
if (Test-Path -Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
}
if (Test-Path -Path "node_modules\.cache") {
    Remove-Item -Path "node_modules\.cache" -Recurse -Force
}

# Check if .env file exists
if (-not (Test-Path -Path ".env")) {
    Write-Host "No .env file found. Creating from .env.example..." -ForegroundColor Yellow
    if (Test-Path -Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host ".env file created from example. Please update it with your API keys." -ForegroundColor Green
    } else {
        Write-Host "No .env.example file found. Please create a .env file manually." -ForegroundColor Red
        exit 1
    }
}

# Rebuild the images
Write-Host "Rebuilding all containers with no cache..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml build --no-cache

# Start the containers with proper error handling
Write-Host "Starting rebuilt containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up -d --force-recreate
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start containers even with forced recreation." -ForegroundColor Red
    Write-Host "Attempting emergency cleanup and restart..." -ForegroundColor Yellow
    
    # Emergency cleanup but preserve database volumes for persistence
    docker-compose -f docker-compose.dev.yml down --remove-orphans
    # Only prune containers and networks, not volumes
    docker container prune -f
    docker network prune -f
    
    # Final attempt
    docker-compose -f docker-compose.dev.yml up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "All attempts to start containers failed. Trying with fixed configuration..." -ForegroundColor Red
        # Try with fixed configuration
        docker-compose -f docker-compose-fixed.yml up -d
        if ($LASTEXITCODE -ne 0) {
            Write-Host "All attempts to start containers failed. See errors above." -ForegroundColor Red
            exit 1
        }
    }
}

# Check if containers are running
$runningContainers = (docker-compose -f docker-compose.dev.yml ps --services | Measure-Object -Line).Lines
if ($runningContainers -gt 0) {
    Write-Host "Development containers rebuilt and started successfully!" -ForegroundColor Green
    
    # Print the actual ports being used
    $appPort = "3001"
    $pgAdminPort = "5050"
    
    try {
        $portOutput = docker-compose -f docker-compose.dev.yml port app 3000
        if ($portOutput -match ":(\d+)") {
            $appPort = $matches[1]
        }
    } catch {}
    
    try {
        $portOutput = docker-compose -f docker-compose.dev.yml port pgadmin 80
        if ($portOutput -match ":(\d+)") {
            $pgAdminPort = $matches[1]
        }
    } catch {}
    
    Write-Host "Web app: http://localhost:$appPort" -ForegroundColor Green
    Write-Host "pgAdmin: http://localhost:$pgAdminPort (login with admin@socialgenius.com / admin)" -ForegroundColor Green
    
    # Check database connectivity
    Write-Host "Testing database connectivity..." -ForegroundColor Yellow
    # Wait for application to connect to database
    Start-Sleep -Seconds 20
    
    # Check if the tables are created successfully
    Write-Host "Checking if database tables are initialized..." -ForegroundColor Yellow
    $dbCheck = docker exec ${PROJECT_NAME}_app_1 node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@172.18.0.2:5432/socialgenius', max: 5, connectionTimeoutMillis: 5000 }); pool.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = ''users'')')
    .then(res => { console.log(res.rows[0].exists ? 'Database tables exist' : 'Database tables need to be created'); if (!res.rows[0].exists) { console.log('Initializing database tables...'); pool.query('CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY)').then(() => console.log('Tables created successfully')).catch(err => console.error('Error creating tables:', err)).finally(() => pool.end()); } else { pool.end(); } })
    .catch(err => { console.error('Error checking database:', err); pool.end(); });"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to check database connectivity" -ForegroundColor Red
    }
    
    # Always show logs
    Write-Host "Showing logs..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml logs -f app
} else {
    Write-Host "Containers may have started but aren't running. Check docker ps for status." -ForegroundColor Red
    docker ps -a
    exit 1
}