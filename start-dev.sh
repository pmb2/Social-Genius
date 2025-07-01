#!/usr/bin/env bash

# Color codes
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
NC="\033[0m"

PROJECT="social-genius"
COMPOSE_FILE="docker-compose.dev.yml"
OVERRIDE_FILE="docker-compose.override.yml"
RC_IMAGE="rediscommander/redis-commander:latest"
RC_NAME="${PROJECT}-redis-commander"
RC_BASE=8082
RC_MAX=$((RC_BASE+100))

# service→container port
declare -A SVC_PORT=( [app]=3000 )
# host‐port base for app
BASE_APP=3001

# find free port helper
find_free() {
  local start=$1 end=$2
  for p in $(seq $start $end); do
    if ! lsof -i:"$p" -t >/dev/null && \
       { ! command -v netstat >/dev/null || ! netstat -tuln | grep -q ":$p "; }; then
      echo $p; return 0
    fi
  done
  return 1
}

echo -e "${YELLOW}▶ Starting Social Genius dev…${NC}"

# 1) Docker up?
docker info >/dev/null 2>&1 || { echo -e "${RED}Docker not running.${NC}"; exit 1; }

# 2) Tear down project
echo -e "${YELLOW}▶ Stopping existing containers…${NC}"
docker-compose -f $COMPOSE_FILE down >/dev/null 2>&1 || true

# 3) Pick app host port
echo -e "${YELLOW}▶ Finding free host port for app (from ${BASE_APP})…${NC}"
APP_PORT=$(find_free $BASE_APP $((BASE_APP+100))) || {
  echo -e "${RED}No free port for app in ${BASE_APP}–$((BASE_APP+100)).${NC}" ; exit 1; }
echo -e "${GREEN}→ app → host:${APP_PORT}${NC}"

# 4) Write override for app only
cat > $OVERRIDE_FILE <<EOF
version: '3.8'
services:
  app:
    ports:
      - "${APP_PORT}:${SVC_PORT[app]}"
EOF
echo -e "${YELLOW}▶ Wrote ${OVERRIDE_FILE} with app:${APP_PORT}->${SVC_PORT[app]}${NC}"

# 5) Bring up core services (excluding redis-commander)
ALL=( $(docker-compose -f $COMPOSE_FILE config --services) )
CORE=()
for svc in "${ALL[@]}"; do
  [[ "$svc" == "redis-commander" ]] && continue
  CORE+=("$svc")
done
echo -e "${YELLOW}▶ Bringing up core services with override…${NC}"
docker-compose -f $COMPOSE_FILE -f $OVERRIDE_FILE up -d "${CORE[@]}"

# 6) Redis-Commander manual
echo -e "${YELLOW}▶ Scanning for free port ≥ ${RC_BASE}…${NC}"
RC_PORT=$(find_free $RC_BASE $RC_MAX) || { echo -e "${RED}No free port for Redis-Commander.${NC}"; exit 1; }
echo -e "${GREEN}→ Redis-Commander → host:${RC_PORT}${NC}"

docker rm -f $RC_NAME >/dev/null 2>&1 || true
docker run -d --name $RC_NAME \
  --network ${PROJECT}_social_genius_network \
  -p ${RC_PORT}:8081 \
  -e REDIS_HOST=redis -e REDIS_PORT=6379 \
  $RC_IMAGE

# 7) Done
echo -e "\n${GREEN}✓ All up!${NC}"
echo -e " • App:            http://localhost:${APP_PORT}"
echo -e " • PostgreSQL:     localhost:5432"
echo -e " • pgAdmin:        http://localhost:5050"
echo -e " • Redis-Commander: http://localhost:${RC_PORT}\n"

echo -e "${YELLOW}▶ Tailing app logs… Ctrl+C${NC}"
docker-compose -f $COMPOSE_FILE -f $OVERRIDE_FILE logs -f app
