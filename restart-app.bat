@echo off
echo === Social Genius App Restart for Windows ===
echo This script will restart the app with database fixes

REM Stop all containers
echo Stopping all containers...
docker-compose -f docker-compose.dev.yml down

REM Rebuild the containers
echo Building containers with fixed configuration...
docker-compose -f docker-compose.dev.yml build app

REM Start everything up
echo Starting all services...
docker-compose -f docker-compose.dev.yml up -d

REM Wait for services to initialize
echo Waiting for services to initialize...
timeout /t 10 /nobreak > NUL

echo === Social Genius App Restart Complete ===
echo You can access the application at: http://localhost:3000
echo To see app logs, run: docker-compose -f docker-compose.dev.yml logs -f app

REM Show logs
docker-compose -f docker-compose.dev.yml logs -f app