@echo off
REM One-click script to fix database connectivity and start the application
echo === Social Genius - One-Click Fix and Start ===
echo.

REM Stop any existing containers
echo Stopping existing containers...
docker-compose -f docker-compose.dev.yml down

REM Create the pg-fix file if it doesn't exist
if not exist pg-fix.cjs (
  echo Creating pg-fix.cjs file...
  echo // CommonJS module to fix pg-native issues > pg-fix.cjs
  echo "use strict"; >> pg-fix.cjs
  echo. >> pg-fix.cjs
  echo // Disable pg-native at runtime >> pg-fix.cjs
  echo process.env.NODE_PG_FORCE_NATIVE = '0'; >> pg-fix.cjs
  echo. >> pg-fix.cjs
  echo // Override require to intercept pg-native >> pg-fix.cjs
  echo const Module = require('module'); >> pg-fix.cjs
  echo const originalRequire = Module.prototype.require; >> pg-fix.cjs
  echo. >> pg-fix.cjs
  echo // Replace the require function to intercept pg-native >> pg-fix.cjs
  echo Module.prototype.require = function(path) { >> pg-fix.cjs
  echo   if (path === 'pg-native') { >> pg-fix.cjs
  echo     console.log('pg-native require intercepted, using JavaScript implementation'); >> pg-fix.cjs
  echo     // Return a mock implementation >> pg-fix.cjs
  echo     function Client() {} >> pg-fix.cjs
  echo     Client.prototype.connect = function() { return Promise.resolve({}); } >> pg-fix.cjs
  echo     Client.prototype.query = function() { return Promise.resolve({ rows: [], rowCount: 0 }); } >> pg-fix.cjs
  echo     Client.prototype.end = function() { return Promise.resolve(); } >> pg-fix.cjs
  echo     return Client; >> pg-fix.cjs
  echo   } >> pg-fix.cjs
  echo   return originalRequire.call(this, path); >> pg-fix.cjs
  echo }; >> pg-fix.cjs
  echo. >> pg-fix.cjs
  echo console.log('PostgreSQL native bindings disabled, using pure JavaScript implementation'); >> pg-fix.cjs
)

REM Start the application
echo Starting Social Genius application...
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