@echo off
echo === Social Genius - Application Startup ===
echo.

REM Stop any existing containers
echo Stopping any existing containers...
docker-compose -f docker-compose.dev.yml down

REM Build and start the containers
echo Building and starting the application...
docker-compose -f docker-compose.dev.yml up -d --build

echo.
echo Waiting for application to start (this may take a minute)...
timeout /t 30 /nobreak > NUL

echo.
echo === Application Started ===
echo The application should now be available at:
echo http://localhost:3000
echo.
echo You can check logs with:
echo docker-compose -f docker-compose.dev.yml logs -f app
echo.

REM Open the application
start http://localhost:3000

echo View logs? (y/n)
set /p SHOW_LOGS=

if /i "%SHOW_LOGS%"=="y" (
  docker-compose -f docker-compose.dev.yml logs -f app
)