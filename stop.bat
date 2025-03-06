@echo off
setlocal enabledelayedexpansion

:: Color codes for Windows
set "GREEN=[32m"
set "YELLOW=[33m"
set "RED=[31m"
set "NC=[0m"

:: Project name for container naming
set "PROJECT_NAME=social-genius"

echo %YELLOW%Stopping Social Genius containers...%NC%

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

if "!FOUND_CONTAINERS!"=="" (
  echo %YELLOW%No Social Genius containers found to stop.%NC%
  exit /b 0
)

echo %YELLOW%Found the following containers:%NC%
echo !FOUND_CONTAINERS!

:: Determine if we should remove volumes
set /p REMOVE_VOLUMES=Would you like to remove the database volumes? (data will be lost) [y/N] 

if /i "!REMOVE_VOLUMES!"=="y" (
  echo %YELLOW%Stopping containers and removing volumes...%NC%
  
  :: Try production compose file first
  docker-compose down -v
  if %ERRORLEVEL% equ 0 (
    echo %GREEN%Production containers stopped and volumes removed.%NC%
    goto :done
  )
  
  :: If that fails, try development compose file
  docker-compose -f docker-compose.dev.yml down -v
  if %ERRORLEVEL% equ 0 (
    echo %GREEN%Development containers stopped and volumes removed.%NC%
    goto :done
  )
  
  :: If both fail, stop containers manually
  echo %RED%Failed to stop containers with compose. Stopping containers manually.%NC%
  for /f "tokens=*" %%a in ('docker ps -a --filter name^=%PROJECT_NAME% -q') do (
    docker stop %%a
    docker rm %%a
  )
  echo %GREEN%Containers stopped and removed.%NC%
) else (
  echo %YELLOW%Stopping containers and preserving volumes...%NC%
  
  :: Try production compose file first
  docker-compose down
  if %ERRORLEVEL% equ 0 (
    echo %GREEN%Production containers stopped.%NC%
    goto :done
  )
  
  :: If that fails, try development compose file
  docker-compose -f docker-compose.dev.yml down
  if %ERRORLEVEL% equ 0 (
    echo %GREEN%Development containers stopped.%NC%
    goto :done
  )
  
  :: If both fail, stop containers manually
  echo %RED%Failed to stop containers with compose. Stopping containers manually.%NC%
  for /f "tokens=*" %%a in ('docker ps -a --filter name^=%PROJECT_NAME% -q') do (
    docker stop %%a
    docker rm %%a
  )
  echo %GREEN%Containers stopped and removed.%NC%
)

:done
:: Show running containers
echo %GREEN%Current running containers:%NC%
docker ps

endlocal