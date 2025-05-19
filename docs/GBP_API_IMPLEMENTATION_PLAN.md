# Google Business Profile API Implementation Plan

## Summary
This document outlines the comprehensive plan to transition Social-Genius from browser automation to the official Google Business Profile (GBP) API. This transition will provide more reliable, stable, and feature-rich integration with Google Business Profile services.

## Background
Currently, Social-Genius uses browser automation through a browser-use service to manage Google Business Profile accounts. This approach has several limitations:
- Frequent breakage due to Google UI changes
- Performance issues with browser instances
- Limited reliability for automated tasks
- Potential authentication challenges
- No official support from Google

By moving to the official Google Business Profile API, we will gain:
- Officially supported methods for data access and management
- More reliable and stable operations
- Better performance through direct API calls
- Enhanced security through OAuth authentication
- Guaranteed API compatibility and versioning

## Current Implementation Status
Based on the code examination, we have made significant progress:

- Created a Google OAuth service for authentication flow
- Implemented an OAuth service for getting, storing, and refreshing tokens
- Built a Google Business Profile service with API interaction capabilities
- Added API endpoints for OAuth URL generation and callback handling
- Developed the OAuth modal for user login

The OAuth implementation features a robust design with:
- Secure token storage with encryption
- Automatic token refresh
- CSRF protection with state parameter
- Proper error handling and user feedback

## Remaining Implementation Tasks

### 1. Feature Flag Configuration
- [ ] Confirm feature flag settings for `GoogleAuthWithOAuth` in the database
- [ ] Update feature flag services to properly check for OAuth availability

### 2. UI Components
- [x] Implement OAuth modal for business addition
- [ ] Update existing dashboard to use OAuth components when feature flag is enabled
- [ ] Remove the email/password fields from the business addition form
- [ ] Simplify the UI flow to only collect business name before OAuth

### 3. Database Schema
- [ ] Verify necessary tables are in place:
  - `google_oauth_tokens`
  - `google_business_accounts`
  - `google_business_locations`

### 4. API Implementation
- [ ] Complete API implementations for business operations:
  - [ ] Posts management
  - [ ] Reviews response
  - [ ] Business information updates
  - [ ] Insights and metrics

### 5. Migration Strategy
- [ ] Develop a strategy for migrating existing browser-automation businesses to OAuth
- [ ] Create a background task to prompt users to re-authenticate via OAuth

### 6. Testing
- [ ] Comprehensive testing of the OAuth flow
- [ ] Verification of token refresh and persistence
- [ ] Testing of business operations with the API
- [ ] Error handling and recovery testing

### 7. Documentation
- [ ] Update user documentation for the new authentication flow
- [ ] Document API capabilities and limitations for the development team

## Detailed Implementation Approach

### Authentication Flow
1. User clicks "Add Business" in the dashboard
2. User enters business name
3. User clicks "Sign in with Google" button
4. Backend generates OAuth URL with state parameter containing user ID and business name
5. User is redirected to Google for authentication and consent
6. Google redirects back to our callback URL with auth code
7. Backend exchanges code for tokens and stores them securely
8. Backend creates business record in database with the OAuth connection
9. User is redirected to dashboard with successful connection message

### API Operations Implementation
For each operation (posts, reviews, updates), we need to:
1. Create service methods in the `GoogleBusinessProfileService` class
2. Implement proper error handling and rate limiting
3. Add the necessary API endpoints for frontend integration
4. Update the UI components to use the new API endpoints

### Token Management
The token management system should:
1. Securely store refresh and access tokens
2. Automatically refresh expired access tokens
3. Handle token revocation when a business is removed
4. Provide proper error handling for authentication issues

## Technical Considerations

### Security
- OAuth tokens must be stored encrypted in the database
- CSRF protection with state parameters
- Proper validation of callback parameters
- Secure handling of sensitive business data

### Performance
- Minimize API requests with appropriate caching
- Batch operations when possible to reduce API calls
- Implement retry logic for transient errors

### Error Handling
- Graceful degradation when API is unavailable
- Clear user feedback for authentication issues
- Logging for debugging purposes
- Automated recovery when possible

## Migration Timeline
1. **Phase 1: Parallel Implementation (Current)** - Implement OAuth alongside browser automation
2. **Phase 2: Testing & Validation** - Test OAuth with selected users
3. **Phase 3: Gradual Rollout** - Enable OAuth for new businesses and prompt existing users to migrate
4. **Phase 4: Complete Transition** - Deprecate browser automation approach

## Conclusion
By transitioning to the official Google Business Profile API, Social-Genius will gain significant improvements in reliability, performance, and feature capabilities. The current implementation progress is substantial, with remaining tasks focused on completing specific API operations and ensuring a smooth user experience.