# PowerShell script for starting the application with custom domain configuration
param(
    [switch]$Rebuild = $false,
    [switch]$Force = $false,
    [switch]$NoLogs = $false
)

# Color output
function Write-ColorOutput {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

# Function to check if a port is in use
function Check-PortInUse {
    param (
        [int]$Port
    )
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    
    if ($connections) {
        $process = Get-Process -Id ($connections | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue
        $processName = if ($process) { $process.ProcessName } else { "Unknown" }
        $processId = if ($process) { $process.Id } else { "Unknown" }
        
        return @{
            InUse = $true
            ProcessName = $processName
            ProcessId = $processId
            Connections = $connections
        }
    } else {
        return @{
            InUse = $false
        }
    }
}

# Function to handle port conflicts
function Resolve-PortConflict {
    param (
        [int]$Port,
        [string]$ServiceName
    )
    
    $portInfo = Check-PortInUse -Port $Port
    
    if ($portInfo.InUse) {
        Write-ColorOutput "Port $Port is already in use by process $($portInfo.ProcessName) (PID: $($portInfo.ProcessId))" "Red"
        
        $options = @(
            "Kill the process and continue",
            "Use an alternative port",
            "Exit the script"
        )
        
        # Only prompt if not using -Force
        if (-not $Force) {
            Write-ColorOutput "Choose an option:" "Yellow"
            for ($i = 0; $i -lt $options.Count; $i++) {
                Write-ColorOutput "$($i+1). $($options[$i])" "Cyan"
            }
            
            $choice = Read-Host "Enter your choice (1-3)"
            
            switch ($choice) {
                1 {
                    Write-ColorOutput "Stopping process $($portInfo.ProcessName) (PID: $($portInfo.ProcessId))..." "Yellow"
                    Stop-Process -Id $portInfo.ProcessId -Force
                    Start-Sleep -Seconds 2
                    
                    # Verify port is now free
                    $checkAgain = Check-PortInUse -Port $Port
                    if ($checkAgain.InUse) {
                        Write-ColorOutput "Failed to free port $Port. Please manually stop the process and try again." "Red"
                        exit 1
                    } else {
                        Write-ColorOutput "Port $Port is now available." "Green"
                        return $Port
                    }
                }
                2 {
                    $alternativePort = if ($Port -eq 80) { 8082 } elseif ($Port -eq 443) { 448 } else { $Port + 1000 }
                    Write-ColorOutput "Using alternative port $alternativePort for $ServiceName" "Yellow"
                    return $alternativePort
                }
                3 {
                    Write-ColorOutput "Exiting script as requested." "Yellow"
                    exit 0
                }
                default {
                    Write-ColorOutput "Invalid choice. Using alternative port." "Red"
                    $alternativePort = if ($Port -eq 80) { 8082 } elseif ($Port -eq 443) { 448 } else { $Port + 1000 }
                    Write-ColorOutput "Using alternative port $alternativePort for $ServiceName" "Yellow"
                    return $alternativePort
                }
            }
        } else {
            # If using -Force, automatically use alternative ports
            $alternativePort = if ($Port -eq 80) { 8082 } elseif ($Port -eq 443) { 448 } else { $Port + 1000 }
            Write-ColorOutput "Using alternative port $alternativePort for $ServiceName (forced)" "Yellow"
            return $alternativePort
        }
    } else {
        return $Port
    }
}

Write-ColorOutput "Starting Social Genius with custom domain configuration..." "Green"

# Check if Docker is running
try {
    $null = docker info
    Write-ColorOutput "Docker is running" "Green"
} catch {
    Write-ColorOutput "Docker is not running. Attempting to start Docker..." "Yellow"
    
    # Check if Docker Desktop is installed
    if (Test-Path "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe") {
        Write-ColorOutput "Starting Docker Desktop..." "Yellow"
        Start-Process "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
        
        # Wait for Docker to start (max 60 seconds)
        Write-ColorOutput "Waiting for Docker to start (this may take a moment)..." "Yellow"
        $dockerStarted = $false
        for ($i = 1; $i -le 60; $i++) {
            Start-Sleep -Seconds 1
            Write-Progress -Activity "Waiting for Docker" -Status "Checking..." -PercentComplete ($i * 100 / 60)
            
            try {
                $null = docker info
                $dockerStarted = $true
                break
            } catch {
                # Still waiting
            }
        }
        
        Write-Progress -Activity "Waiting for Docker" -Completed
        
        if ($dockerStarted) {
            Write-ColorOutput "Docker started successfully!" "Green"
        } else {
            Write-ColorOutput "Timed out waiting for Docker to start. Please start Docker manually and try again." "Red"
            exit 1
        }
    } else {
        # Try to start Docker service if Docker Engine is installed
        try {
            $service = Get-Service -Name docker -ErrorAction Stop
            if ($service.Status -ne "Running") {
                Write-ColorOutput "Starting Docker service..." "Yellow"
                Start-Service -Name docker
                Start-Sleep -Seconds 5
                
                try {
                    $null = docker info
                    Write-ColorOutput "Docker service started successfully!" "Green"
                } catch {
                    Write-ColorOutput "Docker service started but Docker is not responding. Please check Docker status and try again." "Red"
                    exit 1
                }
            }
        } catch {
            Write-ColorOutput "Docker is not installed or not detected. Please install Docker and try again." "Red"
            exit 1
        }
    }
}

# Check for existing containers
$containers = docker ps -a --filter name=social-genius --format "{{.Names}}"
if ($containers) {
    Write-ColorOutput "Found existing Social Genius containers:" "Yellow"
    Write-Host $containers
    
    if (-not $Force) {
        $stopChoice = Read-Host "Would you like to stop these containers? [Y/n]"
        if ($stopChoice -eq "n") {
            Write-ColorOutput "Cannot start new containers while old ones are running. Exiting." "Red"
            exit 1
        }
    }
    
    Write-ColorOutput "Stopping existing containers..." "Yellow"
    docker-compose down
    Write-ColorOutput "Existing containers stopped." "Green"
}

# Check for .env file
if (-not (Test-Path .env)) {
    Write-ColorOutput "No .env file found. Creating from .env.example..." "Yellow"
    if (Test-Path .env.example) {
        Copy-Item .env.example .env
        Write-ColorOutput ".env file created from example. Please update it with your API keys." "Green"
    } else {
        Write-ColorOutput "No .env.example file found. Please create a .env file manually." "Red"
        exit 1
    }
}

# Create certbot directories if they don't exist
if (-not (Test-Path certbot/conf)) {
    New-Item -Path certbot/conf -ItemType Directory -Force | Out-Null
}
if (-not (Test-Path certbot/www)) {
    New-Item -Path certbot/www -ItemType Directory -Force | Out-Null
}

# Check for SSL certificates
if (-not (Test-Path certbot/conf/live/www.gbp.backus.agency)) {
    Write-ColorOutput "SSL certificates not found." "Yellow"
    Write-ColorOutput "For local development, we'll proceed with HTTP only." "Yellow"
    Write-ColorOutput "If you have existing certificates, place them in certbot\conf\live\www.gbp.backus.agency\" "Cyan"
    Write-ColorOutput "(fullchain.pem and privkey.pem files are needed)" "Cyan"
    
    if (-not $Force) {
        Read-Host "Press Enter to continue with HTTP only..."
    }
}

# Check for port conflicts
$httpPort = Resolve-PortConflict -Port 80 -ServiceName "HTTP/Nginx"
$httpsPort = Resolve-PortConflict -Port 443 -ServiceName "HTTPS/Nginx"

# If ports were changed, update docker-compose.custom.yml
if ($httpPort -ne 80 -or $httpsPort -ne 443) {
    $composeFile = Get-Content -Path docker-compose.custom.yml -Raw
    $composeFile = $composeFile -replace "- ""8082:80""", "- ""$httpPort`:80"""
    $composeFile = $composeFile -replace "- ""448:443""", "- ""$httpsPort`:443"""
    Set-Content -Path docker-compose.custom.yml -Value $composeFile
    Write-ColorOutput "Updated docker-compose.custom.yml with new ports: HTTP $httpPort, HTTPS $httpsPort" "Green"
}

# Rebuild if requested
if ($Rebuild) {
    Write-ColorOutput "Rebuilding containers..." "Yellow"
    docker-compose -f docker-compose.custom.yml build
}

# Start the containers
Write-ColorOutput "Starting custom containers..." "Yellow"
docker-compose -f docker-compose.custom.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "Custom containers started successfully!" "Green"
    Write-ColorOutput "Your application is now available at:" "Green"
    Write-ColorOutput "  - HTTP: http://localhost:$httpPort" "Cyan"
    Write-ColorOutput "  - HTTPS: https://localhost:$httpsPort (if SSL is configured)" "Cyan"
    
    # Show logs if not suppressed
    if (-not $NoLogs) {
        $viewLogs = if (-not $Force) { (Read-Host "Would you like to view logs? [Y/n]") } else { "y" }
        if ($viewLogs -ne "n") {
            docker-compose -f docker-compose.custom.yml logs -f app
        } else {
            Write-ColorOutput "To view logs later, run: docker-compose -f docker-compose.custom.yml logs -f app" "Yellow"
        }
    } else {
        Write-ColorOutput "Logs suppressed. To view logs, run: docker-compose -f docker-compose.custom.yml logs -f app" "Yellow"
    }
} else {
    Write-ColorOutput "Failed to start containers. Please check the error messages above." "Red"
    exit 1
}