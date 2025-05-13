# Google Business Profile API Implementation Tasks

## Phase 1: OAuth 2.0 Implementation and Core APIs (4 weeks)

### Week 1: Google Cloud Project Setup and API Access
- [ ] Create a new Google Cloud Project for Social Genius
  - [ ] Go to https://console.cloud.google.com/
  - [ ] Create a new project named "Social-Genius-GBP"
  - [ ] Note the Project ID for configuration
- [ ] Enable required APIs in Google Cloud Console
  - [ ] My Business Account Management API
  - [ ] My Business Information API
  - [ ] My Business Q&A API
  - [ ] My Business Verifications API
  - [ ] My Business Business Calls API
  - [ ] My Business Lodging API
  - [ ] My Business Places API
  - [ ] Business Profile Performance API
- [ ] Configure OAuth consent screen
  - [ ] Set up External user type (if not in production yet)
  - [ ] Add app name, user support email, developer contact
  - [ ] Add domain verification
  - [ ] Configure scopes: https://www.googleapis.com/auth/business.manage
  - [ ] Add test users for development
- [ ] Create OAuth 2.0 credentials
  - [ ] Create Web application OAuth client ID
  - [ ] Add authorized redirect URIs: https://yourdomain.com/api/google-auth/callback
  - [ ] Download and securely store client ID and secret
- [ ] Submit Google Business Profile API access application
  - [ ] Complete access request form at https://developers.google.com/my-business/content/prereqs
  - [ ] Include business justification and project details

### Week 2: Authentication Flow Implementation
- [x] Create database schema for token storage
  - [x] Create google_oauth_tokens table
  - [x] Create migrations for database updates
- [x] Create encryption utilities for token security
  - [x] Create src/lib/utilities/crypto.ts with encrypt/decrypt functions
- [x] Implement GoogleOAuthService
  - [x] Create src/services/google/oauth-service.ts
  - [x] Implement token retrieval and refresh
  - [x] Implement secure token storage
- [x] Create OAuth API routes
  - [x] Create src/app/api/google-auth/url/route.ts
  - [x] Create src/app/api/google-auth/callback/route.ts
- [x] Update Add Business Modal
  - [x] Create src/components/business/profile/add-business-modal-oauth.tsx
  - [x] Replace credential fields with Google OAuth flow
  - [x] Add business name input before OAuth redirect

### Week 3: Business Profile Data Fetching
- [x] Implement GoogleBusinessProfileService
  - [x] Create src/services/google/business-profile-service.ts
  - [x] Add methods for account discovery and location listing
  - [x] Implement error handling and retry logic
- [x] Create database models for Google business data
  - [x] Add google_business_accounts table
  - [x] Add google_business_locations table
- [x] Implement API routes for business data
  - [x] Create src/app/api/google-business/profile/route.ts
  - [x] Create src/app/api/google-business/locations/route.ts
- [x] Create data normalization utilities
  - [x] Create src/lib/utilities/google-data-normalizer.ts
  - [x] Map API responses to application data models
  - [x] Create response caching for frequent requests
- [x] Update business dashboard component
  - [x] Create src/components/business/profile/dashboard-oauth.tsx
  - [x] Update data fetching to use new API endpoints

### Week 4: Testing and Fallback Implementation
- [x] Create feature flag service
  - [x] Create src/services/feature-flag-service.ts
  - [x] Create migrations for feature_flags table
  - [x] Add configuration for API vs browser automation
- [x] Implement graceful fallback mechanism
  - [x] Add fallback to browser automation when API fails
  - [x] Create decision logic for appropriate method
- [x] Add comprehensive error handling
  - [x] Implement request throttling for API rate limits
  - [x] Create centralized error tracking for API issues
- [x] Create monitoring and logging
  - [x] Create src/lib/utilities/google-api-logger.ts
  - [x] Add detailed API call logging
  - [x] Track token refresh cycles
  - [x] Monitor API quota usage
- [ ] Implement automated tests
  - [ ] Unit tests for OAuth service
  - [ ] Integration tests for API endpoints
  - [ ] End-to-end tests for authentication flow

## Phase 2: Advanced Features and Automation (4 weeks)

### Week 1-2: Review Management
- [ ] Implement review fetching via API
- [ ] Create reply-to-review functionality
- [ ] Build review analytics and reporting
- [ ] Update UI to use API-based review management

### Week 2-3: Post Management
- [ ] Implement post creation via API
- [ ] Develop post scheduling capabilities
- [ ] Add support for different post types (updates, events, offers)
- [ ] Update UI for post creation/management via API

### Week 3-4: Business Information Updates
- [ ] Implement location data update operations
- [ ] Add support for hours, special hours, and attributes
- [ ] Create validation for update operations
- [ ] Update UI for business information management

### Week 4: Final Testing and Optimization
- [ ] Comprehensive testing across all features
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] Documentation updates