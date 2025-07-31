@echo off
setlocal enabledelayedexpansion

:: Project name for container naming
set "PROJECT_NAME=social-genius"

echo Rebuilding Social Genius in development mode...

:: Check if Docker is running
docker info > nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Docker is not running. Please start Docker Desktop and try again.
  exit /b 1
)

:: Stop existing containers but preserve volumes for database persistence
echo Stopping all existing containers but preserving database volumes...
docker-compose -f docker-compose.dev.yml down --remove-orphans

:: Remove any stale networks
echo Removing any stale Docker networks...
docker network prune -f

:: Stop and remove any leftover containers with similar names
echo Removing any leftover containers...
for /f "tokens=*" %%a in ('docker ps -a ^| findstr /R "social.*genius pgadmin postgres"') do (
  for /f "tokens=1" %%b in ("%%a") do (
    echo Removing container %%b
    docker rm -f %%b
  )
)

:: Check for port conflicts and handle them intelligently
echo Checking for port conflicts...
set "ORIGINAL_PORT_APP=3001"
set "ORIGINAL_PORT_PGADMIN=5050"
set "ORIGINAL_PORT_POSTGRES=5432"

:: Initialize the final ports with original values
set "FINAL_PORT_APP=%ORIGINAL_PORT_APP%"
set "FINAL_PORT_PGADMIN=%ORIGINAL_PORT_PGADMIN%"
set "FINAL_PORT_POSTGRES=%ORIGINAL_PORT_POSTGRES%"

:: Function to check if a port is in use
:: Returns 0 if port is free, 1 if in use
:IS_PORT_IN_USE
set "PORT_TO_CHECK=%1"
netstat -ano | findstr /R /C:":%PORT_TO_CHECK% " >nul
if %ERRORLEVEL% equ 0 (
  exit /b 1
) else (
  exit /b 0
)

:: Function to find an alternative port
:: Sets the new port in the variable name passed as %2
:FIND_ALTERNATIVE_PORT
set "BASE_PORT=%1"
set "VAR_NAME=%2"
set "ALT_PORT=%BASE_PORT%"

:FIND_ALT_PORT_LOOP
call :IS_PORT_IN_USE %ALT_PORT%
if %ERRORLEVEL% equ 0 (
  :: Port is free
  set "%VAR_NAME%=%ALT_PORT%"
  exit /b 0
) else (
  :: Port is in use, try next
  set /a "ALT_PORT+=1"
  if !ALT_PORT! lss %BASE_PORT%+100 (
    goto :FIND_ALT_PORT_LOOP
  ) else (
    echo Could not find a free port in range %BASE_PORT%-%ALT_PORT%. Please free up some ports.
    exit /b 1
  )
)

:: Check and assign final ports for each service
call :CHECK_AND_ASSIGN_PORT %ORIGINAL_PORT_APP% FINAL_PORT_APP APP
call :CHECK_AND_ASSIGN_PORT %ORIGINAL_PORT_PGADMIN% FINAL_PORT_PGADMIN PGADMIN
call :CHECK_AND_ASSIGN_PORT %ORIGINAL_PORT_POSTGRES% FINAL_PORT_POSTGRES POSTGRES

:: Subroutine to check and assign port for a service
:CHECK_AND_ASSIGN_PORT
set "CURRENT_PORT=%1"
set "FINAL_PORT_VAR_NAME=%2"
set "SERVICE_NAME=%3"

echo Checking port %CURRENT_PORT% for %SERVICE_NAME%...

call :IS_PORT_IN_USE %CURRENT_PORT%
if %ERRORLEVEL% equ 1 (
  :: Port is in use. Check if it's a Docker container.
  for /f "tokens=1" %%I in ('docker ps -q --filter "publish=%CURRENT_PORT%" --format "{{.ID}}"') do (
    echo Port %CURRENT_PORT% is used by our own Docker container (ID: %%I). Stopping it...
    docker stop %%I >nul
  )
  
  :: Re-check after stopping Docker container
  call :IS_PORT_IN_USE %CURRENT_PORT%
  if %ERRORLEVEL% equ 1 (
    echo Port %CURRENT_PORT% is still in use by another application. Finding alternative port...
    call :FIND_ALTERNATIVE_PORT %CURRENT_PORT% %FINAL_PORT_VAR_NAME%
    if %ERRORLEVEL% neq 0 exit /b 1
    echo Found alternative port: !%FINAL_PORT_VAR_NAME%!
  ) else (
    set "%FINAL_PORT_VAR_NAME%=%CURRENT_PORT%"
  )
) else (
  set "%FINAL_PORT_VAR_NAME%=%CURRENT_PORT%"
)
goto :EOF

echo Using ports: app=%FINAL_PORT_APP%, pgadmin=%FINAL_PORT_PGADMIN%, postgres=%FINAL_PORT_POSTGRES%

:: Function to check if a port is in use
:: Returns 0 if port is free, 1 if in use
:IS_PORT_IN_USE
set "PORT_TO_CHECK=%1"
netstat -ano | findstr /R /C:":%PORT_TO_CHECK% " >nul
if %ERRORLEVEL% equ 0 (
  exit /b 1
) else (
  exit /b 0
)

:: Function to find an alternative port
:: Sets the new port in the variable name passed as %2
:FIND_ALTERNATIVE_PORT
set "BASE_PORT=%1"
set "VAR_NAME=%2"
set "ALT_PORT=%BASE_PORT%"

:FIND_ALT_PORT_LOOP
call :IS_PORT_IN_USE %ALT_PORT%
if %ERRORLEVEL% equ 0 (
  :: Port is free
  set "%VAR_NAME%=%ALT_PORT%"
  exit /b 0
) else (
  :: Port is in use, try next
  set /a "ALT_PORT+=1"
  if %ALT_PORT% lss %BASE_PORT%+100 (
    goto :FIND_ALT_PORT_LOOP
  ) else (
    echo Could not find a free port in range %BASE_PORT%-%ALT_PORT%. Please free up some ports.
    exit /b 1
  )
)

:: Check and assign final ports for each service
call :CHECK_AND_ASSIGN_PORT %ORIGINAL_PORT_APP% FINAL_PORT_APP APP
call :CHECK_AND_ASSIGN_PORT %ORIGINAL_PORT_PGADMIN% FINAL_PORT_PGADMIN PGADMIN
call :CHECK_AND_ASSIGN_PORT %ORIGINAL_PORT_POSTGRES% FINAL_PORT_POSTGRES POSTGRES

:: Subroutine to check and assign port for a service
:CHECK_AND_ASSIGN_PORT
set "CURRENT_PORT=%1"
set "FINAL_PORT_VAR_NAME=%2"
set "SERVICE_NAME=%3"

echo Checking port %CURRENT_PORT% for %SERVICE_NAME%...

call :IS_PORT_IN_USE %CURRENT_PORT%
if %ERRORLEVEL% equ 1 (
  :: Port is in use. Check if it's a Docker container.
  for /f "tokens=1" %%I in ('docker ps -q --filter "publish=%CURRENT_PORT%" --format "{{.ID}}"') do (
    echo Port %CURRENT_PORT% is used by our own Docker container (ID: %%I). Stopping it...
    docker stop %%I >nul
  )
  
  :: Re-check after stopping Docker container
  call :IS_PORT_IN_USE %CURRENT_PORT%
  if %ERRORLEVEL% equ 1 (
    echo Port %CURRENT_PORT% is still in use by another application. Finding alternative port...
    call :FIND_ALTERNATIVE_PORT %CURRENT_PORT% %FINAL_PORT_VAR_NAME%
    if %ERRORLEVEL% neq 0 exit /b 1
    echo Found alternative port: !%FINAL_PORT_VAR_NAME%!
  ) else (
    set "%FINAL_PORT_VAR_NAME%=%CURRENT_PORT%"
  )
) else (
  set "%FINAL_PORT_VAR_NAME%=%CURRENT_PORT%"
)
goto :EOF

echo Using ports: app=%FINAL_PORT_APP%, pgadmin=%FINAL_PORT_PGADMIN%, postgres=%FINAL_PORT_POSTGRES%

:: Subroutine to check and assign port for a service
:CHECK_AND_ASSIGN_PORT
set "CURRENT_PORT=%1"
set "FINAL_PORT_VAR_NAME=%2"
set "SERVICE_NAME=%3"

echo Checking port %CURRENT_PORT% for %SERVICE_NAME%...

call :IS_PORT_IN_USE %CURRENT_PORT%
if %ERRORLEVEL% equ 1 (
  :: Port is in use. Check if it's a Docker container.
  for /f "tokens=1" %%I in ('docker ps -q --filter "publish=%CURRENT_PORT%" --format "{{.ID}}"') do (
    echo Port %CURRENT_PORT% is used by our own Docker container (ID: %%I). Stopping it...
    docker stop %%I >nul
  )
  
  :: Re-check after stopping Docker container
  call :IS_PORT_IN_USE %CURRENT_PORT%
  if %ERRORLEVEL% equ 1 (
    echo Port %CURRENT_PORT% is still in use by another application. Finding alternative port...
    call :FIND_ALTERNATIVE_PORT %CURRENT_PORT% %FINAL_PORT_VAR_NAME%
    if %ERRORLEVEL% neq 0 exit /b 1
    echo Found alternative port: !%FINAL_PORT_VAR_NAME%!
  ) else (
    set "%FINAL_PORT_VAR_NAME%=%CURRENT_PORT%"
  )
) else (
  set "%FINAL_PORT_VAR_NAME%=%CURRENT_PORT%"
)
goto :EOF

echo Using ports: app=%FINAL_PORT_1%, pgadmin=%FINAL_PORT_2%, postgres=%FINAL_PORT_3%

:: Create a temporary docker-compose override file if needed
set "CREATE_OVERRIDE="
if not "%FINAL_PORT_APP%"=="%ORIGINAL_PORT_APP%" set "CREATE_OVERRIDE=true"
if not "%FINAL_PORT_PGADMIN%"=="%ORIGINAL_PORT_PGADMIN%" set "CREATE_OVERRIDE=true"
if not "%FINAL_PORT_POSTGRES%"=="%ORIGINAL_PORT_POSTGRES%" set "CREATE_OVERRIDE=true"

if defined CREATE_OVERRIDE (
  echo Creating temporary docker-compose override for custom ports...
  
  (
    echo version: '3.8'
    echo services:
  ) > docker-compose.override.yml
  
  if not "%FINAL_PORT_APP%"=="%ORIGINAL_PORT_APP%" (
    (
      echo   app:
      echo     ports:
      echo       - "%FINAL_PORT_APP%:3000"
    ) >> docker-compose.override.yml
  )
  
  if not "%FINAL_PORT_PGADMIN%"=="%ORIGINAL_PORT_PGADMIN%" (
    (
      echo   pgadmin:
      echo     ports:
      echo       - "%FINAL_PORT_PGADMIN%:5050"
    ) >> docker-compose.override.yml
  )
  
  if not "%FINAL_PORT_POSTGRES%"=="%ORIGINAL_PORT_POSTGRES%" (
    (
      echo   postgres:
      echo     ports:
      echo       - "%FINAL_PORT_POSTGRES%:5432"
    ) >> docker-compose.override.yml
  )
  
  echo Created docker-compose override file with custom ports.
) else (
  :: If no custom ports, ensure override file doesn't exist to avoid conflicts
  if exist docker-compose.override.yml del docker-compose.override.yml
  echo All ports are available, no override needed.
) else (
  :: If no custom ports, ensure override file doesn't exist to avoid conflicts
  if exist docker-compose.override.yml del docker-compose.override.yml
  echo All ports are available, no override needed.
)

:: Apply database connection fixes
echo Applying database connection fixes...
:: Copy fixed postgres service to the active service
copy /Y services\postgres-service-fixed.ts services\postgres-service.ts
echo Database service fixed applied.

:: Clean up any previous builds
echo Cleaning up previous builds...
if exist dist\ rmdir /S /Q dist\
if exist node_modules\.cache rmdir /S /Q node_modules\.cache

:: Check if .env file exists
if not exist .env (
  echo No .env file found. Creating from .env.example...
  if exist .env.example (
    copy .env.example .env >nul
    echo .env file created from example. Please update it with your API keys.
  ) else (
    echo No .env.example file found. Please create a .env file manually.
    exit /b 1
  )
)

:: Rebuild the images
echo Rebuilding all containers with no cache...
if defined CREATE_OVERRIDE (
  echo Using custom port configuration for build...
  docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml build --no-cache
) else (
  docker-compose -f docker-compose.dev.yml build --no-cache
)

:: Start the containers with proper error handling
echo Starting rebuilt containers...
if defined CREATE_OVERRIDE (
  echo Using custom port configuration...
  docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d --force-recreate
) else (
  docker-compose -f docker-compose.dev.yml up -d --force-recreate
)

if %ERRORLEVEL% neq 0 (
  echo Failed to start containers even with forced recreation.
  echo Attempting emergency cleanup and restart...
  
  :: Emergency cleanup but preserve database volumes for persistence
  if defined CREATE_OVERRIDE (
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml down --remove-orphans
  ) else (
    docker-compose -f docker-compose.dev.yml down --remove-orphans
  )
  
  :: Only prune containers and networks, not volumes
  docker container prune -f
  docker network prune -f
  
  :: Final attempt
  if defined CREATE_OVERRIDE (
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d
  ) else (
    docker-compose -f docker-compose.dev.yml up -d
  )
  
  if %ERRORLEVEL% neq 0 (
    echo All attempts to start containers failed. Trying with fixed configuration...
    :: Try with fixed configuration
    if exist docker-compose-fixed.yml (
      docker-compose -f docker-compose-fixed.yml up -d
      if %ERRORLEVEL% neq 0 (
        echo All attempts to start containers failed. See errors above.
        exit /b 1
      )
    ) else (
      echo No fixed configuration available. All attempts to start containers failed.
      exit /b 1
    )
  )
)

:: Check if containers are running
if defined CREATE_OVERRIDE (
  for /f %%c in ('docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml ps --services ^| find /c /v ""') do set RUNNING_CONTAINERS=%%c
) else (
  for /f %%c in ('docker-compose -f docker-compose.dev.yml ps --services ^| find /c /v ""') do set RUNNING_CONTAINERS=%%c
)

if %RUNNING_CONTAINERS% gtr 0 (
  echo Development containers rebuilt and started successfully!
  
  :: Print the actual ports being used
  if defined CREATE_OVERRIDE (
    echo Web app: http://localhost:%FINAL_PORT_1%
    echo pgAdmin: http://localhost:%FINAL_PORT_2% (login with admin@socialgenius.com / admin)
  ) else (
    for /f "tokens=*" %%p in ('docker-compose -f docker-compose.dev.yml port app 3000 ^| findstr /R /C:":[0-9]*" ^| for /f "tokens=2 delims=:" %%a in ("%%p") do @echo %%a') do (
      set APP_PORT=%%p
    )
    if "!APP_PORT!"=="" set APP_PORT=3001
    
    for /f "tokens=*" %%p in ('docker-compose -f docker-compose.dev.yml port pgadmin 80 ^| findstr /R /C:":[0-9]*" ^| for /f "tokens=2 delims=:" %%a in ("%%p") do @echo %%a') do (
      set PGADMIN_PORT=%%p
    )
    if "!PGADMIN_PORT!"=="" set PGADMIN_PORT=5050
    
    echo Web app: http://localhost:!APP_PORT!
    echo pgAdmin: http://localhost:!PGADMIN_PORT! (login with admin@socialgenius.com / admin)
  )
  
  :: Check database connectivity
  echo Testing database connectivity...
  :: Wait for application to connect to database
  timeout /t 20 /nobreak >nul
  
  :: Check if the tables are created successfully
  echo Checking if database tables are initialized...
  docker exec %PROJECT_NAME%_app_1 node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@172.18.0.2:5432/socialgenius', max: 5, connectionTimeoutMillis: 5000 }); pool.query('SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = ''users''')').then(res => { console.log(res.rows[0].exists ? 'Database tables exist' : 'Database tables need to be created'); if (!res.rows[0].exists) { console.log('Initializing database tables...'); pool.query('CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY)').then(() => console.log('Tables created successfully')).catch(err => console.error('Error creating tables:', err)).finally(() => pool.end()); } else { pool.end(); } }).catch(err => { console.error('Error checking database:', err); pool.end(); });"
  if %ERRORLEVEL% neq 0 echo Failed to check database connectivity
  
  :: Always show logs
  echo Showing logs...
  if defined CREATE_OVERRIDE (
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml logs -f app
  ) else (
    docker-compose -f docker-compose.dev.yml logs -f app
  )
) else (
  echo Containers may have started but aren't running. Check docker ps for status.
  docker ps -a
  exit /b 1
)

endlocal