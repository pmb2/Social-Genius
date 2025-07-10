# Social Genius Development Environment Management

This document outlines how to use the `gemini-restart.sh` script to manage your local Social Genius development environment.

## `gemini-restart.sh` Script Overview

The `gemini-restart.sh` script is a comprehensive tool designed to ensure a clean and consistent development environment. It automates several tasks, including:

1.  **Docker Status Check**: Verifies if Docker is running and attempts to start Docker Desktop on macOS if it's not.
2.  **Cleanup**: Stops and removes all existing Docker containers, prunes stale networks, and cleans up any leftover containers to ensure a fresh start.
3.  **Port Conflict Resolution**:
    *   Dynamically detects ports used by services defined in `docker-compose` files (e.g., `app`, `pgadmin`, `postgres`, `redis`, `browser-use-api`, `redis-commander`).
    *   Checks for conflicts with processes running on your host machine and other Docker containers.
    *   Attempts to kill conflicting processes and stop conflicting Docker containers.
    *   If a port is still in use, it finds an alternative available port.
    *   If any ports are reassigned, it automatically generates a `docker-compose.override.yml` file to reflect the new port mappings. This file is automatically used by subsequent `docker-compose` commands.
4.  **Database Fixes**: Applies specific database connection fixes by copying `services/postgres-service-fixed.ts` to `services/postgres-service.ts`.
5.  **Custom Server Setup**: Ensures the `server.cjs` (Express server for Next.js) file is present, creating it if necessary.
6.  **Environment File Management**: Creates a `.env` file from `.env.example` if one doesn't already exist, prompting you to update it with your API keys.
7.  **Rebuild and Start**: Rebuilds all Docker images from scratch (using `--no-cache` to ensure the latest changes) and starts the containers in detached mode (`-d`). It includes retry logic for container startup.
8.  **Verification**: After startup, it performs basic checks to ensure containers are running and database tables are initialized.

## How to Use

To rebuild and restart the Social Genius application in development mode, simply run the script from the project root:

```bash
./gemini-restart.sh
```

### Important Notes:

*   **Background Execution**: The `gemini-restart.sh` script runs in the background and does not stream logs to the terminal. After running the script, please wait approximately 4 minutes for the application to fully initialize.
*   **Checking Logs**: To view the application logs after the script has finished, you can use the following command: `docker-compose -f docker-compose.dev.yml logs -f app`
*   **Port Changes**: If the script reassigns ports due to conflicts, it will inform you and update `docker-compose.override.yml`. You should use the reported URLs (e.g., `http://localhost:XXXX`) to access the application.
*   **`.env` File**: If a `.env` file is created, remember to open it and fill in your actual API keys and secrets as required.
*   **Troubleshooting**: If the application is not working after the script has finished, you can inspect container logs manually using `docker-compose logs <service_name>`. do not use -f or stream the logs output.
*   **User Execution**: The user restarts the application via the `rebuild-dev.sh` script, so ensure that it is in sync with your `gemini-restart.sh` script and visa-versa.