@echo off
setlocal enabledelayedexpansion

:: Color codes for Windows Command Prompt
set "GREEN=92"
set "YELLOW=93"
set "RED=91"
set "NC=0"

:: Project name for container naming
set "PROJECT_NAME=social-genius"

echo Starting Social Genius in production mode for domain www.gbp.backus.agency...

:: Check if Docker is running
docker info > nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Docker is not running. Attempting to start Docker...
  
  :: First, check if Docker Desktop is installed
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    echo Starting Docker Desktop...
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    
    :: Wait for Docker to start (max 60 seconds)
    echo Waiting for Docker to start (this may take a moment)...
    for /l %%i in (1, 1, 60) do (
      timeout /t 1 >nul
      docker info >nul 2>&1
      if !ERRORLEVEL! equ 0 (
        echo Docker started successfully!
        goto :docker_running
      )
    )
    
    echo Timed out waiting for Docker to start. Please start Docker manually and try again.
    exit /b 1
  ) else (
    :: Check if Docker service exists (Docker Engine without Docker Desktop)
    sc query docker >nul 2>&1
    if !ERRORLEVEL! equ 0 (
      echo Starting Docker service...
      net start docker
      if !ERRORLEVEL! equ 0 (
        echo Docker service started successfully!
        timeout /t 2 >nul
        
        :: Check if Docker is responsive
        docker info >nul 2>&1
        if !ERRORLEVEL! equ 0 (
          echo Docker is now ready!
          goto :docker_running
        ) else (
          echo Docker service started but Docker is not responding. Please check Docker status and try again.
          exit /b 1
        )
      ) else (
        echo Failed to start Docker service. You may need to run as Administrator.
        exit /b 1
      )
    ) else (
      echo Docker is not installed or not detected. Please install Docker and try again.
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
  echo Found existing Social Genius containers:
  echo !FOUND_CONTAINERS!
  
  set /p CHOICE=Would you like to stop these containers? [Y/n] 
  if /i "!CHOICE!"=="n" (
    echo Cannot start new containers while old ones are running. Exiting.
    exit /b 1
  ) else (
    echo Stopping existing containers...
    docker-compose down
    echo Existing containers stopped.
  )
)

:: Check if .env file exists
if not exist .env (
  echo No .env file found. Creating from .env.example...
  if exist .env.example (
    copy .env.example .env > nul
    echo .env file created from example. Please update it with your API keys.
  ) else (
    echo No .env.example file found. Please create a .env file manually.
    exit /b 1
  )
)

:: Create directories for certbot if they don't exist
if not exist certbot\conf mkdir certbot\conf
if not exist certbot\www mkdir certbot\www

:: Check if SSL certificates already exist, if not, provide instructions
if not exist certbot\conf\live\www.gbp.backus.agency (
  echo SSL certificates not found.
  echo Since automatic certificate generation using certbot requires a publicly accessible server,
  echo you have two options:
  echo.
  echo Option 1: If this server is publicly accessible with ports 80 and 443 open:
  echo   - Use WSL or Git Bash to run the Linux version of this script (start-prod.sh)
  echo.
  echo Option 2: Use pre-existing certificates:
  echo   - Place your SSL certificates in certbot\conf\live\www.gbp.backus.agency\
  echo   - fullchain.pem and privkey.pem files are needed
  echo.
  echo Would you like to continue without SSL certificates? (Not recommended for production)
  set /p CONTINUE_CHOICE=Continue without SSL (y/N)?
  
  if /i "!CONTINUE_CHOICE!"=="y" (
    echo Continuing without SSL certificates. The site will not be accessible via HTTPS.
  ) else (
    echo Exiting. Please set up SSL certificates before continuing.
    exit /b 1
  )
)

:: Ask if user wants to rebuild
set /p REBUILD=Would you like to rebuild the containers? [y/N] 
if /i "!REBUILD!"=="y" (
  echo Rebuilding containers...
  
  :: Extract API keys from .env file
  for /f "tokens=1,2 delims==" %%a in (.env) do (
    set "%%a=%%b"
  )
  
  :: Build with API keys
  docker-compose -f docker-compose.prod.yml build ^
    --build-arg OPENAI_API_KEY=!OPENAI_API_KEY! ^
    --build-arg GROQ_API_KEY=!GROQ_API_KEY! ^
    --build-arg EXA_API_KEY=!EXA_API_KEY! ^
    --build-arg DATABASE_URL=!DATABASE_URL!
)

:: Start the containers
echo Starting production containers...
docker-compose -f docker-compose.prod.yml up -d

if %ERRORLEVEL% equ 0 (
  echo Production containers started successfully!
  echo Your application is now available at https://www.gbp.backus.agency
  
  :: Show logs option
  set /p VIEW_LOGS=Would you like to view logs? [Y/n] 
  if /i "!VIEW_LOGS!"=="n" (
    echo To view logs later, run: docker-compose -f docker-compose.prod.yml logs -f app
  ) else (
    docker-compose -f docker-compose.prod.yml logs -f app
  )
) else (
  echo Failed to start containers. Please check the error messages above.
  exit /b 1
)

endlocal