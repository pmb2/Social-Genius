# Google Business Profile API Implementation Tasks

This document provides specific implementation tasks required to complete the transition from browser automation to Google Business Profile API for Social-Genius.

## UI Components

### Add Business Modal
- [x] Create `add-business-modal-oauth.tsx` component
- [x] Implement OAuth flow in the modal
- [x] Add business name collection step
- [x] Create Google sign-in button with proper styling
- [ ] Add loading states and error handling
- [ ] Polish UI transitions between steps

### Dashboard Integration
- [x] Update `dashboard-oauth.tsx` to support both OAuth and legacy methods
- [x] Implement feature flag check for enabling OAuth
- [ ] Replace original dashboard component with OAuth version
- [ ] Add OAuth credential indicators in the business list

### Business Profile UI
- [ ] Update business profile modal to work with API-connected businesses
- [ ] Add visual indicators for OAuth-connected businesses
- [ ] Implement reconnection flow for expired tokens

## API Endpoints

### Authentication
- [x] Create `/api/google-auth/url` endpoint for generating auth URLs
- [x] Implement `/api/google-auth/callback` for handling OAuth callback
- [ ] Add endpoint for checking OAuth status for a business
- [ ] Create endpoint for reconnecting a business via OAuth

### Business Profile Operations
- [ ] **Posts Management**
  - [ ] Create endpoint for fetching posts
  - [ ] Implement post creation endpoint
  - [ ] Add post update functionality
  - [ ] Create post deletion endpoint
  - [ ] Implement post scheduling capabilities

- [ ] **Reviews Management**
  - [ ] Create endpoint for fetching reviews
  - [ ] Implement review reply endpoint
  - [ ] Add review analytics endpoint

- [ ] **Business Information**
  - [ ] Create endpoint for fetching business details
  - [ ] Implement business info update endpoint
  - [ ] Add special hours management
  - [ ] Implement attributes update functionality

- [ ] **Media Management**
  - [ ] Create endpoint for fetching media
  - [ ] Implement media upload functionality
  - [ ] Add media deletion endpoint

- [ ] **Analytics & Insights**
  - [ ] Create endpoint for basic metrics
  - [ ] Implement detailed analytics endpoint
  - [ ] Add search performance metrics

## Services Implementation

### OAuth Service
- [x] Implement `GoogleOAuthService` class
- [x] Add token generation, storage, and refresh methods
- [x] Implement token migration functionality
- [x] Create token revocation capability
- [ ] Add comprehensive error handling and logging

### Business Profile Service
- [x] Create `GoogleBusinessProfileService` class
- [x] Implement account and location retrieval methods
- [ ] Add location details update functionality
- [ ] Implement the following API operations:
  - [ ] Posts CRUD operations
  - [ ] Reviews management
  - [ ] Business information updates
  - [ ] Media management
  - [ ] Insights and metrics retrieval

### Feature Flag Service
- [x] Implement feature flag for OAuth vs. browser automation
- [ ] Add granular feature flags for specific API capabilities
- [ ] Create admin UI for managing feature flags

## Database Schema

### OAuth Tokens Table
- [x] Create `google_oauth_tokens` table with:
  - [x] User ID
  - [x] Business ID
  - [x] Encrypted access token
  - [x] Encrypted refresh token
  - [x] Token expiry timestamp
  - [x] Creation and update timestamps

### Business Accounts Table
- [x] Create `google_business_accounts` table with:
  - [x] Business ID
  - [x] Google account ID
  - [x] Account name
  - [x] Creation and update timestamps

### Business Locations Table
- [x] Create `google_business_locations` table with:
  - [x] Business ID
  - [x] Google account ID
  - [x] Location ID
  - [x] Location name
  - [x] Is primary flag
  - [x] Creation and update timestamps

## Migration Strategy

### Database Migration
- [ ] Create migration script to update database schema
- [ ] Add migration for new tables
- [ ] Create indexing strategy for optimized queries

### Business Records Migration
- [ ] Create script to identify businesses using browser automation
- [ ] Implement notification system for users to migrate
- [ ] Add UI flow for re-authenticating existing businesses with OAuth

### Cleanup Strategy
- [ ] Create cleanup script for browser automation resources
- [ ] Implement gradual decommissioning of browser automation service
- [ ] Add monitoring for migration progress

## Testing

### Authentication Flow Testing
- [ ] Test OAuth URL generation
- [ ] Verify callback handling
- [ ] Test token storage and encryption
- [ ] Validate token refresh functionality
- [ ] Test error handling scenarios

### API Operations Testing
- [ ] Create test suite for each API operation
- [ ] Implement integration tests for frontend components
- [ ] Add end-to-end tests for common user flows
- [ ] Verify error handling and recovery

### Migration Testing
- [ ] Test migration script on staging environment
- [ ] Verify business data integrity after migration
- [ ] Test user experience for re-authentication flow

## Documentation

### Developer Documentation
- [ ] Document OAuth implementation details
- [ ] Create API operation documentation
- [ ] Add database schema documentation
- [ ] Document feature flag usage

### User Documentation
- [ ] Create user guide for OAuth authentication
- [ ] Add troubleshooting section for common issues
- [ ] Document business profile management features

## Immediate Next Steps

1. Fix and complete the `add-business-modal-oauth.tsx` for seamless authentication
2. Update the dashboard to use the OAuth modal when feature flag is enabled
3. Complete the GBP API implementation for core operations (posts, reviews)
4. Create migration strategy for existing businesses
5. Implement comprehensive testing for authentication flow
6. Deploy to staging for limited user testing

## Timeline and Milestones

1. **Week 1**: Complete OAuth UI components and basic authentication flow
2. **Week 2**: Implement core API operations (business info, posts, reviews)
3. **Week 3**: Create migration strategy and testing
4. **Week 4**: User testing and feedback collection
5. **Week 5**: Full deployment and legacy system decommissioning