# PowerShell script for starting Social Genius in production mode

# Project name for container naming
$PROJECT_NAME = "social-genius"

Write-Host "Starting Social Genius in production mode for domain www.gbp.backus.agency..." -ForegroundColor Yellow

# Function to check if a port is in use and provide details about the process
function Check-PortInUse {
    param (
        [int]$Port
    )
    
    $connections = netstat -ano | Select-String -Pattern ":$Port "
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.ToString().Split(' ')[-1]
            try {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    return @{
                        InUse = $true
                        ProcessId = $processId
                        ProcessName = $process.ProcessName
                        Path = $process.Path
                    }
                }
            } catch {
                return @{
                    InUse = $true
                    ProcessId = $processId
                    ProcessName = "Unknown"
                    Path = "Unknown"
                }
            }
        }
    }
    
    return @{ InUse = $false }
}

# Function to handle port conflicts
function Resolve-PortConflict {
    param (
        [int]$Port,
        [string]$ServiceName
    )
    
    $portInfo = Check-PortInUse -Port $Port
    
    if ($portInfo.InUse) {
        Write-Host "Port $Port is already in use by process $($portInfo.ProcessName) (PID: $($portInfo.ProcessId))" -ForegroundColor Red
        
        $options = @(
            "Kill the process and continue",
            "Use an alternative port",
            "Exit the script"
        )
        
        Write-Host "How would you like to proceed?" -ForegroundColor Yellow
        for ($i = 0; $i -lt $options.Count; $i++) {
            Write-Host "[$($i + 1)] $($options[$i])"
        }
        
        $choice = Read-Host "Enter your choice (1-3)"
        
        switch ($choice) {
            "1" {
                Write-Host "Stopping process $($portInfo.ProcessName) (PID: $($portInfo.ProcessId))..." -ForegroundColor Yellow
                Stop-Process -Id $portInfo.ProcessId -Force
                Start-Sleep -Seconds 2
                return $Port
            }
            "2" {
                $newPort = Read-Host "Enter an alternative port for $ServiceName (e.g., 8080 for HTTP, 8443 for HTTPS)"
                return $newPort
            }
            "3" {
                Write-Host "Exiting script." -ForegroundColor Yellow
                exit
            }
            default {
                Write-Host "Invalid choice. Exiting script." -ForegroundColor Red
                exit
            }
        }
    }
    
    return $Port
}

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

# Create directories for certbot if they don't exist
if (-not (Test-Path -Path "certbot\conf")) {
    New-Item -Path "certbot\conf" -ItemType Directory -Force | Out-Null
}
if (-not (Test-Path -Path "certbot\www")) {
    New-Item -Path "certbot\www" -ItemType Directory -Force | Out-Null
}

# Check if SSL certificates already exist, if not, provide instructions
if (-not (Test-Path -Path "certbot\conf\live\www.gbp.backus.agency\fullchain.pem")) {
    Write-Host "SSL certificates not found." -ForegroundColor Yellow
    Write-Host "Since automatic certificate generation using certbot requires a publicly accessible server,"
    Write-Host "you have two options:"
    Write-Host ""
    Write-Host "Option 1: If this server is publicly accessible with ports 80 and 443 open:" -ForegroundColor Green
    Write-Host "  - Use WSL or Git Bash to run the Linux version of this script (start-prod.sh)"
    Write-Host ""
    Write-Host "Option 2: Use pre-existing certificates:" -ForegroundColor Green
    Write-Host "  - Place your SSL certificates in certbot\conf\live\www.gbp.backus.agency\"
    Write-Host "  - fullchain.pem and privkey.pem files are needed"
    Write-Host ""
    
    $continueChoice = Read-Host "Continue without SSL (y/N)?"
    if ($continueChoice -ne "y" -and $continueChoice -ne "Y") {
        Write-Host "Exiting. Please set up SSL certificates before continuing." -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "Continuing without SSL certificates. The site will not be accessible via HTTPS." -ForegroundColor Yellow
    }
}

# Check if .env file exists
if (-not (Test-Path -Path ".env")) {
    if (Test-Path -Path ".env.example") {
        Write-Host "No .env file found. Creating from .env.example..." -ForegroundColor Yellow
        Copy-Item ".env.example" ".env"
        Write-Host ".env file created from example. Please update it with your API keys." -ForegroundColor Green
    } else {
        Write-Host "No .env.example file found. Please create a .env file manually." -ForegroundColor Red
        exit 1
    }
}

# Check for existing containers and stop them if needed
$foundContainers = docker ps -a --filter name=$PROJECT_NAME --format "{{.Names}}"
if ($foundContainers) {
    Write-Host "Found existing Social Genius containers:" -ForegroundColor Yellow
    Write-Host $foundContainers
    
    $stopChoice = Read-Host "Would you like to stop these containers? [Y/n]"
    if ($stopChoice -eq "n" -or $stopChoice -eq "N") {
        Write-Host "Cannot start new containers while old ones are running. Exiting." -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Stopping existing containers..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "Existing containers stopped." -ForegroundColor Green
    }
}

# Check for port conflicts and resolve them
Write-Host "Checking for port conflicts..." -ForegroundColor Yellow
$httpPort = Resolve-PortConflict -Port 80 -ServiceName "HTTP"
$httpsPort = Resolve-PortConflict -Port 443 -ServiceName "HTTPS"

# If testing the build without requiring a full deployment, you can uncomment this line
# For now, we'll skip the build step since we're just getting the app running
$skipBuild = Read-Host "Would you like to skip the build step? (Recommended for now) [Y/n]"

# Create a modified docker-compose file directly
if ($httpPort -ne 80 -or $httpsPort -ne 443) {
    Write-Host "Creating custom docker-compose file with modified ports..." -ForegroundColor Yellow

    # Read the original docker-compose file
    $composeContent = Get-Content -Path "docker-compose.prod.yml" -Raw
    
    # Replace the port mappings in the nginx service
    $composeContent = $composeContent -replace '- "80:80"', "- `"$httpPort`:80`""
    $composeContent = $composeContent -replace '- "443:443"', "- `"$httpsPort`:443`""
    
    # Write to a new file
    $modifiedComposePath = "docker-compose.custom.yml"
    Set-Content -Path $modifiedComposePath -Value $composeContent
    
    Write-Host "Created custom compose file with HTTP port $httpPort and HTTPS port $httpsPort." -ForegroundColor Green
    $composeFile = $modifiedComposePath
} else {
    $composeFile = "docker-compose.prod.yml"
}

# Create missing layout file in app/(protected) directory
$protectedLayoutPath = "app/(protected)/layout.tsx"
if (-not (Test-Path -Path $protectedLayoutPath)) {
    Write-Host "Missing root layout detected. Creating $protectedLayoutPath..." -ForegroundColor Yellow
    $layoutContent = @"
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
"@
    Set-Content -Path $protectedLayoutPath -Value $layoutContent
    Write-Host "Created layout file to fix build error." -ForegroundColor Green
}

# If not skipping the build
if ($skipBuild -ne "Y" -and $skipBuild -ne "y") {
    # Fix next.config.mjs appDir warning
    $nextConfigPath = "next.config.mjs"
    if (Test-Path -Path $nextConfigPath) {
        Write-Host "Updating Next.js configuration..." -ForegroundColor Yellow
        $nextConfig = Get-Content -Path $nextConfigPath -Raw
        
        # Replace appDir with serverComponentsExternalPackages
        $nextConfig = $nextConfig -replace "appDir: true", "appDir: 'deprecated_value'"
        Set-Content -Path $nextConfigPath -Value $nextConfig
        Write-Host "Next.js configuration updated." -ForegroundColor Green
    }

    # Ask if user wants to rebuild
    $rebuildChoice = Read-Host "Would you like to rebuild the containers? [y/N]"
    if ($rebuildChoice -eq "y" -or $rebuildChoice -eq "Y") {
        Write-Host "Rebuilding containers..." -ForegroundColor Yellow
            
        # Load environment variables from .env file
        $envVars = @{}
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '(.+?)=(.+)') {
                $envVars[$matches[1]] = $matches[2]
            }
        }
            
        # Build with environment variables
        $buildArgs = @(
            "-f", $composeFile, "build"
        )
            
        if ($envVars.ContainsKey("OPENAI_API_KEY")) {
            $buildArgs += "--build-arg", "OPENAI_API_KEY=$($envVars['OPENAI_API_KEY'])"
        }
        if ($envVars.ContainsKey("GROQ_API_KEY")) {
            $buildArgs += "--build-arg", "GROQ_API_KEY=$($envVars['GROQ_API_KEY'])"
        }
        if ($envVars.ContainsKey("EXA_API_KEY")) {
            $buildArgs += "--build-arg", "EXA_API_KEY=$($envVars['EXA_API_KEY'])"
        }
        if ($envVars.ContainsKey("DATABASE_URL")) {
            $buildArgs += "--build-arg", "DATABASE_URL=$($envVars['DATABASE_URL'])"
        }
            
        docker-compose $buildArgs
    }
}

# Start the containers
Write-Host "Starting production containers..." -ForegroundColor Yellow
docker-compose -f $composeFile up -d

if ($LASTEXITCODE -eq 0) {
    if ($httpPort -ne 80 -or $httpsPort -ne 443) {
        Write-Host "Production containers started successfully on alternative ports!" -ForegroundColor Green
        Write-Host "Your application is now available at:" -ForegroundColor Green
        Write-Host "  HTTP: http://www.gbp.backus.agency:$httpPort" -ForegroundColor Green
        Write-Host "  HTTPS: https://www.gbp.backus.agency:$httpsPort" -ForegroundColor Green
    } else {
        Write-Host "Production containers started successfully!" -ForegroundColor Green
        Write-Host "Your application is now available at https://www.gbp.backus.agency" -ForegroundColor Green
    }
    
    # Show logs option
    $viewLogs = Read-Host "Would you like to view logs? [Y/n]"
    if ($viewLogs -eq "n" -or $viewLogs -eq "N") {
        Write-Host "To view logs later, run: docker-compose -f $composeFile logs -f app" -ForegroundColor Green
    } else {
        docker-compose -f $composeFile logs -f app
    }
} else {
    Write-Host "Failed to start containers. Please check the error messages above." -ForegroundColor Red
    exit 1
}

# Clean up the custom file if it exists
if (Test-Path -Path "docker-compose.custom.yml" -and $composeFile -eq "docker-compose.custom.yml") {
    Write-Host "Keeping custom compose file for future use: $composeFile" -ForegroundColor Yellow
}