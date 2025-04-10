# Browser Use API for Social Genius

This service provides a dockerized API for browser automation tasks, particularly focused on Google authentication with bot-detection avoidance.

## Features

- Google authentication automation with sophisticated anti-detection
- Asynchronous task processing
- Task status tracking
- Screenshot capture for debugging
- Health check endpoint

## API Endpoints

- **POST /v1/google-auth** - Authenticate with Google (handles captchas)
- **POST /v1/browser-task** - Run a generic browser automation task
- **GET /v1/task/{task_id}** - Get status of a running task
- **POST /v1/terminate/{task_id}** - Terminate a running task
- **GET /health** - Health check

## Running Locally

1. Build the docker image:
   ```
   docker-compose build
   ```

2. Start the service:
   ```
   docker-compose up -d
   ```

3. The API will be available at: http://localhost:5055

## Usage Examples

### Google Authentication

```bash
curl -X POST http://localhost:5055/v1/google-auth \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "businessId": "business-123"
  }'
```

### Generic Browser Task

```bash
curl -X POST http://localhost:5055/v1/browser-task \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Go to google.com and search for Social Genius, then extract the first 3 results",
    "business_id": "business-123"
  }'
```

### Check Task Status

```bash
curl -X GET http://localhost:5055/v1/task/task-id-here
```

## Integration with Social Genius

This API is designed to be used as a service within the Social Genius architecture, providing browser automation capabilities with captcha handling.