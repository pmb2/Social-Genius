#!/bin/bash
# Container Health Check Script
# Tests connectivity between containers and services

set -e

echo "============================================"
echo "Container Health Check"
echo "$(date)"
echo "============================================"

# Function to check HTTP endpoint
check_http() {
  local service_name=$1
  local url=$2
  local max_attempts=${3:-3}
  local attempt=1
  local success=false

  echo "Testing connectivity to $service_name at $url"
  
  while [ $attempt -le $max_attempts ] && [ "$success" = false ]; do
    echo "Attempt $attempt of $max_attempts..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null) || response="FAILED"
    
    if [ "$response" = "200" ] || [ "$response" = "204" ]; then
      echo "✅ Successfully connected to $service_name"
      success=true
    else
      echo "❌ Failed to connect to $service_name: HTTP $response"
      attempt=$((attempt+1))
      
      if [ $attempt -le $max_attempts ]; then
        echo "Retrying in 2 seconds..."
        sleep 2
      fi
    fi
  done
  
  if [ "$success" = true ]; then
    return 0
  else
    return 1
  fi
}

# Function to fix hosts file
fix_hosts_file() {
  echo "Checking if host.docker.internal is in /etc/hosts"
  if ! grep -q "host.docker.internal" /etc/hosts; then
    echo "Adding host.docker.internal to /etc/hosts"
    # Get the host IP using the docker gateway
    HOST_IP=$(ip route | grep default | awk '{print $3}')
    if [ -n "$HOST_IP" ]; then
      # Try to update hosts file (will work if running as root)
      if [ -w "/etc/hosts" ]; then
        echo -e "\n# Added by container-healthcheck.sh\n$HOST_IP host.docker.internal" >> /etc/hosts
        echo "✅ Added $HOST_IP as host.docker.internal to /etc/hosts"
      else
        echo "❌ Cannot write to /etc/hosts (need root access)"
        echo "Please manually add: $HOST_IP host.docker.internal"
      fi
    else
      echo "❌ Could not determine host IP"
    fi
  else
    echo "✅ host.docker.internal is already in /etc/hosts"
  fi
}

# Fix /etc/hosts file if needed
fix_hosts_file

# Add missing Redis hostname to hosts file if needed
if ! grep -q "redis " /etc/hosts; then
  echo "Redis hostname not found in hosts file, attempting to add it"
  # Try to resolve the hostname to host.docker.internal
  if [ -w "/etc/hosts" ]; then
    echo -e "\n# Added by container-healthcheck.sh\n127.0.0.1 redis" >> /etc/hosts
    echo "✅ Added redis to /etc/hosts"
  else
    echo "❌ Cannot write to /etc/hosts (need root access)"
    echo "Please manually add: 127.0.0.1 redis"
  fi
fi

# Check Browser API
echo "Testing Browser-Use API connectivity..."
BROWSER_USE_API_URL=${BROWSER_USE_API_URL:-"http://browser-use-api:5055"}
if check_http "Browser API" "$BROWSER_USE_API_URL/health"; then
  browser_api_status="OK"
else
  browser_api_status="FAIL"
  echo "Consider: docker-compose restart browser-use-api"
fi

# Test direct connectivity to host.docker.internal
echo "Testing host.docker.internal connectivity..."
if ping -c 1 host.docker.internal >/dev/null 2>&1; then
  echo "✅ Successfully pinged host.docker.internal"
  host_ping_status="OK"
else
  echo "❌ Failed to ping host.docker.internal"
  host_ping_status="FAIL"
fi

# Test connectivity to Redis using different URLs
echo "Testing Redis connectivity (multiple URLs)..."
redis_connected=false

# Array of Redis URLs to try
REDIS_URLS=(
  "redis://host.docker.internal:6380"
  "redis://redis:6379"
  "redis://localhost:6380"
  "redis://127.0.0.1:6380"
)

# Function to test Redis connection
test_redis_url() {
  local redis_url=$1
  echo "  Trying Redis URL: $redis_url"
  if redis-cli -u "$redis_url" ping 2>/dev/null | grep -q "PONG"; then
    echo "  ✅ Successfully connected to Redis at $redis_url"
    return 0
  else
    echo "  ❌ Failed to connect to Redis at $redis_url"
    return 1
  fi
}

# Try each Redis URL
for url in "${REDIS_URLS[@]}"; do
  if test_redis_url "$url"; then
    redis_connected=true
    working_redis_url=$url
    break
  fi
done

if [ "$redis_connected" = true ]; then
  redis_status="OK"
  echo "Redis connected successfully at $working_redis_url"
  
  # Update environment variable if a more reliable URL was found
  if [ "$REDIS_URL" != "$working_redis_url" ]; then
    echo "Consider updating REDIS_URL in your environment to: $working_redis_url"
  fi
else
  redis_status="FAIL"
  echo "❌ Failed to connect to Redis"
  echo "Consider: docker-compose restart redis"
fi

# Test Postgres connection
echo "Testing Postgres connectivity..."
DB_URL=${DATABASE_URL:-"postgresql://postgres:postgres@postgres:5432/socialgenius"}
DB_HOST=$(echo $DB_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
DB_PORT=$(echo $DB_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

if nc -z -w5 "$DB_HOST" "$DB_PORT" 2>/dev/null; then
  postgres_status="OK"
  echo "✅ Successfully connected to Postgres"
else
  postgres_status="FAIL"
  echo "❌ Failed to connect to Postgres at $DB_HOST:$DB_PORT"
  echo "Consider: docker-compose restart postgres"
fi

# Ensure screenshots directory exists and has proper permissions
echo "Checking screenshots directory..."
screenshot_dir="/home/ubuntu/Social-Genius/src/api/browser-use/screenshots"
if [ ! -d "$screenshot_dir" ]; then
  echo "📁 Creating screenshots directory at $screenshot_dir"
  mkdir -p "$screenshot_dir"
  echo "✅ Screenshots directory created"
else
  echo "✅ Screenshots directory already exists"
fi

# Ensure proper permissions on screenshots directory
echo "🔐 Setting permissions on screenshots directory"
chmod -R 755 "$screenshot_dir"
echo "✅ Screenshot directory permissions set"

# Test browser screenshot functionality
if [ "$browser_api_status" = "OK" ]; then
  echo "Testing browser screenshot functionality..."
  if command -v node >/dev/null 2>&1; then
    TEST_SCRIPT_PATH="/home/ubuntu/Social-Genius/src/scripts/capture-test-screenshot.js"
    if [ -f "$TEST_SCRIPT_PATH" ]; then
      echo "📸 Running test screenshot capture script"
      node "$TEST_SCRIPT_PATH" &>/tmp/screenshot-test.log
      if [ $? -eq 0 ]; then
        screenshot_status="OK"
        echo "✅ Screenshot test passed"
      else
        screenshot_status="FAIL"
        echo "❌ Screenshot test failed"
        echo "Check log at /tmp/screenshot-test.log"
      fi
    else
      screenshot_status="SKIP"
      echo "⚠️ Test script not found at $TEST_SCRIPT_PATH"
    fi
  else
    screenshot_status="SKIP"
    echo "⚠️ Node.js not available for screenshot test"
  fi
else
  screenshot_status="SKIP"
  echo "⚠️ Skipping screenshot test because Browser API is not available"
fi

# Summary
echo "============================================"
echo "Health Check Summary:"
echo "Browser API: $browser_api_status"
echo "Redis: $redis_status"
echo "Postgres: $postgres_status"
echo "host.docker.internal: $host_ping_status"
echo "Working Redis URL: ${working_redis_url:-NONE}"
echo "Screenshots Directory: $([ -d "$screenshot_dir" ] && echo "OK" || echo "FAIL")"
echo "Screenshot Test: ${screenshot_status:-SKIP}"
echo "============================================"

# Environment Variables Check
echo "Environment Variables Check:"
echo "REDIS_URL: ${REDIS_URL:-not set}"
echo "BROWSER_USE_API_URL: ${BROWSER_USE_API_URL:-not set}"
echo "DATABASE_URL: ${DATABASE_URL:-not set (shortened)}"
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "RUNNING_IN_DOCKER: ${RUNNING_IN_DOCKER:-not set}"
echo "============================================"

# Docker Network Check
if command -v docker >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
  echo "Docker Network Check:"
  echo "Networks:"
  docker network ls | grep social
  
  echo "Network Inspection:"
  docker network inspect social_genius_network || echo "Not found"
  echo "============================================"
fi

# Provide helpful recommendations
echo "Recommendations:"
if [ "$redis_status" = "FAIL" ]; then
  echo "• Update Redis URL in docker-compose to use host.docker.internal"
  echo "• Consider adding 'extra_hosts: - \"host.docker.internal:host-gateway\"' for each service"
  echo "• Restart Redis service: docker-compose restart redis"
fi

if [ "$host_ping_status" = "FAIL" ]; then
  echo "• Add 'extra_hosts: - \"host.docker.internal:host-gateway\"' to all services"
  echo "• Update /etc/hosts manually to include host.docker.internal"
fi

if [ "$browser_api_status" = "FAIL" ]; then
  echo "• Ensure the Browser API service is running: docker-compose up -d browser-use-api"
  echo "• Check Browser API logs: docker-compose logs browser-use-api"
fi

echo "============================================"

# Health check passes if all services are OK
if [ "$browser_api_status" = "OK" ] && [ "$redis_status" = "OK" ] && [ "$postgres_status" = "OK" ] && { [ "$screenshot_status" = "OK" ] || [ "$screenshot_status" = "SKIP" ]; }; then
  echo "✅ All services are healthy!"
  exit 0
else
  echo "❌ Some services are unhealthy!"
  exit 1
fi