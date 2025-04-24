# Social Genius Project Architecture

## Directory Structure

The codebase follows a domain-driven organization:

```
/app                      # Next.js app router pages and API routes
  /(protected)            # Protected routes requiring authentication
  /api                    # API endpoints organized by feature

/src                      # Source code organized by domain
  /components             # React components
    /auth                 # Authentication components
    /business             # Business-related components
      /profile            # Business profile components
      /competitor         # Competitor research components
    /compliance           # Compliance features
    /layout               # Layout components
    /ui                   # Reusable UI components
      /feedback           # Feedback components
  
  /lib                    # Utility functions and shared code
    /auth                 # Authentication utilities
    /ui                   # UI utilities
      /modal              # Modal handling utilities
      /toast              # Toast notification utilities
    /hooks                # React hooks
    /providers            # Context providers
    /research             # Research utilities
    /utilities            # Common utilities
  
  /services               # Backend services
    /api                  # External API clients
      /browser            # Browser automation API
    /auth                 # Authentication services
    /database             # Database services 
    /compliance           # Compliance services
    /subscription         # Subscription services

/public                   # Static assets
/docs                     # Documentation
```

## Key Components

- **Auth System**: Handles user authentication, session management, and authorization
- **Business Profiles**: Manages business profiles for multiple locations
- **Compliance**: Checks and enforces compliance with platform rules
- **Browser Automation**: Handles automated interactions with Google Business Profile
- **Research**: Provides competitor research and analysis tools
- **Subscription**: Manages user subscription plans and billing

## Core Services

### Authentication Service

Responsible for user registration, login, session management, and profile updates.

### Database Service

Handles all interactions with PostgreSQL database, including vector storage for document search.

### Compliance Service

Manages compliance checking and Google Business Profile automation.

### Subscription Service

Handles subscription plans, billing, and payment processing.

## Component Structure

The UI components follow a hierarchical organization:

1. Page components in `/app` directory
2. Feature components in `/src/components`
3. UI primitives in `/src/components/ui`

## State Management

The application uses React context for global state management, with custom hooks for accessing state. Key state providers include:

- AuthContext: User authentication state
- ToastContext: Notification system 
- Various modal contexts: UI state for dialogs

## Data Flow

1. Client-side components make API requests to Next.js API routes
2. API routes use services to interact with the database and external APIs
3. Services use utility functions for common operations
4. Results are returned to components for rendering

## Key Design Patterns

- **Singleton Pattern**: Used for service instances
- **Provider Pattern**: Used for context-based state management
- **Repository Pattern**: Used for database access
- **Adapter Pattern**: Used for external API integration