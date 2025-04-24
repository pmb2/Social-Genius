# Browser Automation Architecture

## Overview

The Social-Genius application incorporates a browser automation system that enables headless Google login and other Google Business Profile interactions. This document outlines the architecture, components, and data flow of this system.

## Key Components

### 1. Python Flask API (`browser-use-api`)
- **Purpose**: Provides a REST API that performs actual browser automation using Selenium
- **Core Components**:
  - Flask application server with API endpoints for different operations
  - Headless browser management with browser-use library
  - Task queue and status tracking system
  - Screenshot capture functionality
  - Error handling and reporting

### 2. JavaScript Bridge Layer (`lib/browser-automation`)
- **Purpose**: Connects the React frontend to the Python automation API
- **Core Components**:
  - `BrowserAutomationService`: Singleton service for API communication
  - `BrowserAutomationConfig`: Centralized configuration
  - `BrowserOperationService`: Service bridge with fallback mechanisms
  - Typed interfaces for requests and responses

### 3. React Integration (`lib/browser-automation/use-google-auth.ts`)
- **Purpose**: Provides React hooks for Google authentication UX
- **Core Components**:
  - `useGoogleAuth` hook for handling authentication flow
  - Progress tracking and status management
  - Error handling and user feedback

### 4. Security Layer (`lib/utilities`)
- **Purpose**: Manages secure handling of credentials
- **Core Components**:
  - Password encryption/decryption utilities
  - Credentials management
  - Secure browser session handling

### 5. API Routes
- **Purpose**: Server endpoints that broker communication between frontend and automation services
- **Core Components**:
  - `/api/compliance/auth`: Authentication endpoint
  - `/api/compliance/task-status`: Task status checking
  - `/api/compliance/check-session`: Session validation

## Data Flow

1. **Authentication Initiation**:
   - User enters Google credentials in the frontend
   - Frontend encrypts credentials
   - Encrypted credentials are sent to the Next.js backend

2. **Backend Processing**:
   - Server validates user session and ownership
   - Credentials are decrypted securely
   - Request is forwarded to the Browser-Use API

3. **Browser Automation**:
   - Python API creates a browser automation task
   - Headless browser performs Google login
   - Screenshots are captured for debugging and verification
   - Login state and cookies are preserved

4. **Status Tracking**:
   - Task ID is returned to the client
   - Frontend polls for task status
   - Success/failure states are handled appropriately

5. **Session Persistence**:
   - On successful authentication, browser session is stored
   - Session can be reused for subsequent operations

## Security Considerations

1. **Credential Handling**:
   - Passwords are never logged in plaintext
   - Encryption is used for credential transfer
   - Sensitive information is redacted in logs

2. **Authentication and Authorization**:
   - User session validation before accessing API
   - Business ownership verification
   - Proper error messages that don't leak information

3. **Browser Session Security**:
   - Sessions associated with specific businesses
   - Timeouts and proper cleanup
   - Isolation between different user sessions

## Logging and Error Handling

The system implements comprehensive logging with categorized and formatted log messages:
- `[BROWSER_AUTOMATION]` - General browser automation operations
- `[GOOGLE-AUTH]` - Google authentication specific logs
- `[AUTH-API]` - API-related authentication logging
- `[COMPLIANCE_AUTH]` - Compliance-related authentication logs

Error handling includes:
- Descriptive error codes and messages
- Error screenshots for debugging
- Fallback mechanisms when primary methods fail

## Docker Integration

The browser automation service runs in its own container:
- Isolates browser automation from the main application
- Provides consistent environment for automation
- Manages resources effectively
- Proper healthchecks for container orchestration

## Fallback Mechanisms

The system implements multiple fallback options:
1. External API (browser-use-api) as primary method
2. Local Playwright-based automation as backup
3. Graceful degradation when services are unavailable

## Future Enhancements

1. Enhanced session persistence and reuse
2. More robust CAPTCHA handling
3. Better error recovery strategies
4. Additional Google Business Profile operations