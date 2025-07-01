# PowerShell script to start Social Genius with database fixes
Write-Host "===== Social Genius Application Startup =====" -ForegroundColor Cyan
Write-Host "This script will start the application with database fixes" -ForegroundColor Cyan
Write-Host ""

# Stop any running containers
Write-Host "Stopping any existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.fixed.yml down

# Clean volumes if requested
if ($args[0] -eq "--clean") {
    Write-Host "Cleaning up Docker volumes..." -ForegroundColor Yellow
    docker volume rm social-genius_postgres_data social-genius_redis_data -f
}

# Start all services with the fixed configuration
Write-Host "Starting all services..." -ForegroundColor Green
docker-compose -f docker-compose.fixed.yml up -d

# Wait for services to initialize
Write-Host "Waiting for services to initialize (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Check app status
Write-Host "Checking application status..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "Application is running! Visit http://localhost:3000 in your browser" -ForegroundColor Green
    }
} 
catch {
    Write-Host "Application still starting, please wait a few more moments..." -ForegroundColor Yellow
    Write-Host "Visit http://localhost:3000 in your browser" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "To view application logs, run:" -ForegroundColor Cyan
Write-Host "docker-compose -f docker-compose.fixed.yml logs -f app" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the application, run:" -ForegroundColor Cyan
Write-Host "docker-compose -f docker-compose.fixed.yml down" -ForegroundColor Cyan

# Optionally show logs
if ($args[0] -eq "--logs" -or $args[1] -eq "--logs") {
    Write-Host "Showing application logs:" -ForegroundColor Yellow
    docker-compose -f docker-compose.fixed.yml logs -f app
}