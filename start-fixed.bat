@echo off
echo ===== Social Genius Application Startup =====
echo This script will start the application with database fixes

REM Stop any running containers
echo Stopping any existing containers...
docker-compose -f docker-compose.fixed.yml down

REM Start all services with the fixed configuration
echo Starting all services...
docker-compose -f docker-compose.fixed.yml up -d

REM Wait for services to initialize
echo Waiting for services to initialize (15 seconds)...
timeout /t 15 /nobreak > NUL

REM Check app status
echo Checking application status...
curl -s http://localhost:3000 >NUL
if %ERRORLEVEL% EQU 0 (
  echo Application is running! Visit http://localhost:3000 in your browser
) else (
  echo Application still starting, please wait a few more moments...
  echo Visit http://localhost:3000 in your browser
)

echo.
echo To view application logs, run:
echo docker-compose -f docker-compose.fixed.yml logs -f app
echo.
echo To stop the application, run:
echo docker-compose -f docker-compose.fixed.yml down
echo.