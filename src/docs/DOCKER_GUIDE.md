# Docker Guide for Social Genius

This guide explains how to use Docker to run the Social Genius application with PostgreSQL.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

> **Note**: The included scripts (`start-dev.sh`, `start-prod.sh`, `stop.sh` and their Windows equivalents) will automatically attempt to start Docker if it's not running. This requires appropriate permissions and Docker must be properly installed on your system.

## Development Setup

For local development with hot reloading:

1. Copy `.env.example` to `.env` and set your API keys:

```bash
cp .env.example .env
```

2. Start the development environment:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This will start:
- Next.js app in development mode with hot reloading
- PostgreSQL with pgvector extension
- pgAdmin for database management (optional)

3. Access the services:
   - Web app: http://localhost:3000
   - pgAdmin: http://localhost:5050 (login with admin@socialgenius.com / admin)

4. View logs:

```bash
docker-compose -f docker-compose.dev.yml logs -f app
```

5. Stop the development environment:

```bash
docker-compose -f docker-compose.dev.yml down
```

## Production Setup

For production deployment:

1. Build and start the containers:

```bash
# Build with your API keys (replace with actual keys)
docker-compose build \
  --build-arg OPENAI_API_KEY=your_openai_key \
  --build-arg GROQ_API_KEY=your_groq_key \
  --build-arg EXA_API_KEY=your_exa_key

# Start the containers
docker-compose up -d
```

2. For subsequent starts (without rebuilding):

```bash
docker-compose up -d
```

3. Stop the production environment:

```bash
docker-compose down
```

## Environment Variables

You can provide environment variables in several ways:

1. **Build Arguments**: Set during container building (for API keys in production)
2. **Docker Compose Environment**: Directly in the docker-compose.yml file
3. **ENV File**: Using an env_file in docker-compose 

Example with env_file:

```yaml
services:
  app:
    env_file:
      - .env.production
```

## Data Persistence

PostgreSQL data is stored in a named volume `postgres_data`. This ensures your data persists even when containers are removed.

To backup your data:

```bash
docker exec -t social-genius_postgres_1 pg_dump -U postgres -d socialgenius > backup.sql
```

To restore from backup:

```bash
cat backup.sql | docker exec -i social-genius_postgres_1 psql -U postgres -d socialgenius
```

## Docker Compose Commands

Common commands:

```bash
# Start containers
docker-compose up -d

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f app

# Stop and remove containers without removing volumes
docker-compose down

# Stop and remove containers including volumes
docker-compose down -v

# Rebuild containers after code changes
docker-compose build
docker-compose up -d
```

## Troubleshooting

1. **Database connection issues**:
   - Check if the postgres container is running: `docker ps`
   - Verify DATABASE_URL in your environment variables
   - Try connecting manually: `docker exec -it social-genius_postgres_1 psql -U postgres -d socialgenius`

2. **Permissions issues with /tmp directory**:
   - The Dockerfiles create and set permissions for the /tmp directory
   - If PDF processing fails, check container logs: `docker-compose logs app`

3. **Container fails to start**:
   - Check logs: `docker-compose logs app`
   - Verify all required environment variables are set

4. **Performance issues**:
   - For production, adjust the PostgreSQL configuration for better performance
   - Consider using a volume mount for the node_modules to improve rebuilds