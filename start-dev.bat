@echo off
setlocal enabledelayedexpansion

:: Color codes for Windows
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "NC=[0m"

:: Project name for container naming
set "PROJECT_NAME=social-genius"

echo %YELLOW%Starting Social Genius in development mode...%NC%

:: Check if Docker is running
docker info > nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo %YELLOW%Docker is not running. Attempting to start Docker...%NC%
  
  :: First, check if Docker Desktop is installed
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    echo %YELLOW%Starting Docker Desktop...%NC%
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    
    :: Wait for Docker to start (max 60 seconds)
    echo %YELLOW%Waiting for Docker to start (this may take a moment)...%NC%
    for /l %%i in (1, 1, 60) do (
      timeout /t 1 >nul
      docker info >nul 2>&1
      if !ERRORLEVEL! equ 0 (
        echo %GREEN%Docker started successfully!%NC%
        goto :docker_running
      )
    )
    
    echo %RED%Timed out waiting for Docker to start. Please start Docker manually and try again.%NC%
    exit /b 1
  ) else (
    :: Check if Docker service exists (Docker Engine without Docker Desktop)
    sc query docker >nul 2>&1
    if !ERRORLEVEL! equ 0 (
      echo %YELLOW%Starting Docker service...%NC%
      net start docker
      if !ERRORLEVEL! equ 0 (
        echo %GREEN%Docker service started successfully!%NC%
        timeout /t 2 >nul
        
        :: Check if Docker is responsive
        docker info >nul 2>&1
        if !ERRORLEVEL! equ 0 (
          echo %GREEN%Docker is now ready!%NC%
          goto :docker_running
        ) else (
          echo %RED%Docker service started but Docker is not responding. Please check Docker status and try again.%NC%
          exit /b 1
        )
      ) else (
        echo %RED%Failed to start Docker service. You may need to run as Administrator.%NC%
        exit /b 1
      )
    ) else (
      echo %RED%Docker is not installed or not detected. Please install Docker and try again.%NC%
      exit /b 1
    )
  )
)

:docker_running

:: Check for existing containers with the project name
set "FOUND_CONTAINERS="
for /f "tokens=*" %%a in ('docker ps -a --filter name^=%PROJECT_NAME% --format "{{.Names}}"') do (
  set "FOUND_CONTAINERS=!FOUND_CONTAINERS!%%a "
)

if not "!FOUND_CONTAINERS!"=="" (
  echo %YELLOW%Found existing Social Genius containers:%NC%
  echo !FOUND_CONTAINERS!
  
  set /p CHOICE=Would you like to stop these containers? [Y/n] 
  if /i "!CHOICE!"=="n" (
    echo %RED%Cannot start new containers while old ones are running. Exiting.%NC%
    exit /b 1
  ) else (
    echo %YELLOW%Stopping existing containers...%NC%
    docker-compose -f docker-compose.dev.yml down
    echo %GREEN%Existing containers stopped.%NC%
  )
)

:: Check if .env file exists
if not exist .env (
  echo %YELLOW%No .env file found. Creating from .env.example...%NC%
  if exist .env.example (
    copy .env.example .env > nul
    echo %GREEN%.env file created from example. Please update it with your API keys.%NC%
  ) else (
    echo %RED%No .env.example file found. Please create a .env file manually.%NC%
    exit /b 1
  )
)

:: Start the containers
echo %YELLOW%Starting development containers...%NC%
docker-compose -f docker-compose.dev.yml up -d

if %ERRORLEVEL% equ 0 (
  echo %GREEN%Development containers started successfully!%NC%
  echo %GREEN%Web app: http://localhost:3000%NC%
  echo %GREEN%pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)%NC%
  
  :: Show logs option
  set /p VIEW_LOGS=Would you like to view logs? [Y/n] 
  if /i "!VIEW_LOGS!"=="n" (
    echo %GREEN%To view logs later, run: docker-compose -f docker-compose.dev.yml logs -f app%NC%
  ) else (
    docker-compose -f docker-compose.dev.yml logs -f app
  )
) else (
  echo %RED%Failed to start containers. Please check the error messages above.%NC%
  exit /b 1
)

endlocal