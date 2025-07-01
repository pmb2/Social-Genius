@echo off
setlocal enabledelayedexpansion

:: Project name for container naming
set "PROJECT_NAME=social-genius"

echo Starting Social Genius in development mode...

docker info > nul 2>&1
if %errorlevel% neq 0 (
  echo Docker is not running. Please start Docker and try again.
  exit /b 1
)

echo Checking for existing containers...
docker-compose -f docker-compose.dev.yml down

if not exist .env (
  if exist .env.example (
    copy .env.example .env > nul
    echo Created .env file from example.
  ) else (
    echo No .env.example file found. Please create a .env file manually.
    exit /b 1
  )
)

:: Check for port conflicts and handle them intelligently
echo Checking for port conflicts...
set "ORIGINAL_PORT_1=3001"
set "ORIGINAL_PORT_2=5050"
set "ORIGINAL_PORT_3=5432"

:: Initialize the final ports with original values
set "FINAL_PORT_1=%ORIGINAL_PORT_1%"
set "FINAL_PORT_2=%ORIGINAL_PORT_2%"
set "FINAL_PORT_3=%ORIGINAL_PORT_3%"

:: Check each port for conflicts
for %%p in (3001 5050 5432) do (
  echo Checking port %%p...
  
  :: Check if port is in use
  set "PORT_IN_USE="
  for /f "tokens=5" %%i in ('netstat -ano ^| findstr /R ":%%p "') do (
    set "PORT_IN_USE=true"
    
    :: Check if it's our own docker container
    for /f "tokens=*" %%c in ('docker ps -q --filter "name=%PROJECT_NAME%" --filter "publish=%%p"') do (
      echo Port %%p is used by our own container. Stopping it...
      docker stop %%c
      set "PORT_IN_USE="
    )
    
    if defined PORT_IN_USE (
      echo Port %%p is used by another application. Finding alternative port...
      
      :: Find an alternative port
      set "ALT_PORT=%%p"
      set /a "ALT_PORT+=1"
      
      :check_alt_port
      set "ALT_PORT_IN_USE="
      for /f "tokens=5" %%j in ('netstat -ano ^| findstr /R ":%ALT_PORT% "') do (
        set "ALT_PORT_IN_USE=true"
      )
      
      if defined ALT_PORT_IN_USE (
        set /a "ALT_PORT+=1"
        if !ALT_PORT! lss %%p+100 (
          goto check_alt_port
        ) else (
          echo Could not find a free port in range %%p-!ALT_PORT!. Please free up some ports.
          exit /b 1
        )
      )
      
      echo Found alternative port: !ALT_PORT!
      
      :: Update the final port variable based on which original port we're checking
      if %%p==3001 set "FINAL_PORT_1=!ALT_PORT!"
      if %%p==5050 set "FINAL_PORT_2=!ALT_PORT!"
      if %%p==5432 set "FINAL_PORT_3=!ALT_PORT!"
    )
  )
)

echo Using ports: app=%FINAL_PORT_1%, pgadmin=%FINAL_PORT_2%, postgres=%FINAL_PORT_3%

:: Create a temporary docker-compose override file if needed
set "CREATE_OVERRIDE="
if not "%FINAL_PORT_1%"=="%ORIGINAL_PORT_1%" set "CREATE_OVERRIDE=true"
if not "%FINAL_PORT_2%"=="%ORIGINAL_PORT_2%" set "CREATE_OVERRIDE=true"
if not "%FINAL_PORT_3%"=="%ORIGINAL_PORT_3%" set "CREATE_OVERRIDE=true"

if defined CREATE_OVERRIDE (
  echo Creating temporary docker-compose override for custom ports...
  
  (
    echo version: '3.8'
    echo services:
  ) > docker-compose.override.yml
  
  if not "%FINAL_PORT_1%"=="%ORIGINAL_PORT_1%" (
    (
      echo   app:
      echo     ports:
      echo       - "%FINAL_PORT_1%:3000"
    ) >> docker-compose.override.yml
  )
  
  if not "%FINAL_PORT_2%"=="%ORIGINAL_PORT_2%" (
    (
      echo   pgadmin:
      echo     ports:
      echo       - "%FINAL_PORT_2%:5050"
    ) >> docker-compose.override.yml
  )
  
  if not "%FINAL_PORT_3%"=="%ORIGINAL_PORT_3%" (
    (
      echo   postgres:
      echo     ports:
      echo       - "%FINAL_PORT_3%:5432"
    ) >> docker-compose.override.yml
  )
  
  echo Created docker-compose override file with custom ports.
)

:: Start Docker containers with or without override
echo Starting Docker containers...

if defined CREATE_OVERRIDE (
  echo Using custom port configuration...
  docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d
) else (
  docker-compose -f docker-compose.dev.yml up -d
)

if %errorlevel% equ 0 (
  echo Development services started successfully!
  
  :: Print the actual ports being used
  if defined CREATE_OVERRIDE (
    echo Web app: http://localhost:%FINAL_PORT_1%
    echo pgAdmin: http://localhost:%FINAL_PORT_2% (login with admin@socialgenius.com / admin)
    echo Docker logs will show below (Ctrl+C to exit logs)...
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml logs -f
  ) else (
    echo Web app: http://localhost:3001
    echo pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)
    echo Docker logs will show below (Ctrl+C to exit logs)...
    docker-compose -f docker-compose.dev.yml logs -f
  )
) else (
  echo Failed to start containers. Trying with forced recreation...
  
  if defined CREATE_OVERRIDE (
    docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d --force-recreate
  ) else (
    docker-compose -f docker-compose.dev.yml up -d --force-recreate
  )
  
  if %errorlevel% equ 0 (
    echo Development services started successfully after forced recreation!
    
    if defined CREATE_OVERRIDE (
      echo Web app: http://localhost:%FINAL_PORT_1%
      echo pgAdmin: http://localhost:%FINAL_PORT_2% (login with admin@socialgenius.com / admin)
      echo Docker logs will show below (Ctrl+C to exit logs)...
      docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml logs -f
    ) else (
      echo Web app: http://localhost:3001
      echo pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)
      echo Docker logs will show below (Ctrl+C to exit logs)...
      docker-compose -f docker-compose.dev.yml logs -f
    )
  ) else (
    echo Failed to start containers even after forced recreation.
    exit /b 1
  )
)

endlocal