# AWS ALB Health Check Configuration Guide

This document provides guidance on configuring AWS Application Load Balancer (ALB) health checks to reduce log spam while maintaining proper monitoring for the Social Genius application.

## Current Issue

The ALB is sending health check requests too frequently, resulting in excessive log entries:

```
app_1 | GET /api/health 200 in 23ms
app_1 | GET /api/health 200 in 27ms
app_1 | GET /api/health 200 in 26ms
```

## Application Changes

We've implemented the following changes to reduce log spam:

1. Updated the `/api/health` endpoint to improve efficiency
2. Added middleware to suppress logging for health check requests
3. Modified Nginx configuration to suppress logs for both `/health` and `/api/health` paths
4. Added health check paths to public routes list

## Recommended ALB Configuration

To further reduce health check frequency, update the ALB health check settings in AWS Console:

1. Log in to the AWS Console
2. Navigate to EC2 > Load Balancers
3. Select your ALB for Social Genius
4. Go to the "Target Groups" tab
5. Select the target group for Social Genius
6. Click on the "Health checks" tab
7. Click "Edit"

### Recommended Settings

Adjust the following settings:

- **Health check protocol**: HTTP
- **Health check path**: `/health`
- **Port**: traffic port
- **Healthy threshold**: 2 (reduced from default 5)
- **Unhealthy threshold**: 2 (reduced from default 2)
- **Timeout**: 5 seconds (increased from default 5)
- **Interval**: 30 seconds (increased from default 30)
- **Success codes**: 200

The key change is increasing the **Interval** parameter. The default is often 30 seconds, but for a stable application like ours, checking every 60-120 seconds is sufficient.

## Important Notes

1. The health check interval must be greater than the timeout value.
2. Increasing the interval too much could delay detection of application failures.
3. For critical production environments, keep the interval at 60 seconds maximum.
4. For development/testing, intervals of 120-300 seconds are acceptable.

## Implementation Steps

1. Make the configuration changes in the AWS console as described above
2. Monitor the logs to ensure health check requests are reduced
3. Verify that the ALB still properly detects any application outages

The application changes we've implemented will minimize the impact of health checks on logs regardless of the ALB configuration, but adjusting the ALB settings will further reduce the frequency of these requests.