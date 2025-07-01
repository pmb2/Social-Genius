@echo off
echo === Social Genius - Restart Application ===
echo.

REM Stop any existing containers
echo Stopping any existing containers...
docker-compose -f docker-compose.dev.yml down

REM Restart the application
echo Starting application...
docker-compose -f docker-compose.dev.yml up -d

echo.
echo === Application Starting ===
echo The application should now be starting at http://localhost:3000
echo It may take a few moments to fully initialize
echo.
echo To view logs, run: docker-compose -f docker-compose.dev.yml logs -f app
echo.

REM Option to show logs
SET /P SHOWLOGS=Do you want to see application logs? (y/n): 
IF /I "%SHOWLOGS%"=="y" (
  docker-compose -f docker-compose.dev.yml logs -f app
)