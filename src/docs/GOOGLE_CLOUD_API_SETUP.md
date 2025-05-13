# Google Cloud API Setup for Social Genius

This document outlines the Google Cloud API configuration required for the Social Genius application to support Google Business Profile integration.

## Project Configuration

To set up your Google Cloud Project:

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named "Social-Genius-GBP" or your preferred name
3. Note your Project ID (automatically generated or customized during creation)
4. Enable billing for the project if required for API access

## Enabled APIs

The following APIs have been enabled in the Google Cloud Console for Social Genius:

1. **My Business Account Management API**
   - Endpoint Base URL: `https://mybusinessaccountmanagement.googleapis.com/v1/`
   - Purpose: Manage business accounts, locations, and invitations
   - Key Operations:
     - Account discovery
     - Location management
     - Admins and access control

2. **My Business Information API**
   - Endpoint Base URL: `https://mybusinessinformation.googleapis.com/v1/`
   - Purpose: Read and update business information
   - Key Operations:
     - Business attributes management
     - Business hours
     - Contact information
     - Photos and media

3. **My Business Q&A API**
   - Endpoint Base URL: `https://mybusinessqanda.googleapis.com/v1/`
   - Purpose: Manage Questions & Answers for business profiles
   - Key Operations:
     - List questions
     - Answer questions
     - Update existing answers

4. **My Business Verifications API**
   - Endpoint Base URL: `https://mybusinessverifications.googleapis.com/v1/`
   - Purpose: Handle verification processes
   - Key Operations:
     - Request verification
     - Check verification status
     - Complete verification

5. **My Business Business Calls API**
   - Endpoint Base URL: `https://mybusinessbusinesscalls.googleapis.com/v1/`
   - Purpose: Manage business phone call metrics
   - Key Operations:
     - Call history
     - Metrics and reporting

6. **My Business Lodging API**
   - Endpoint Base URL: `https://mybusinesslodging.googleapis.com/v1/`
   - Purpose: Manage lodging-specific business profile data
   - Key Operations:
     - Lodging services
     - Room info
     - Property details

7. **My Business Places API**
   - Endpoint Base URL: `https://mybusinessplaceactions.googleapis.com/v1/`
   - Purpose: Manage place actions for business listings
   - Key Operations:
     - Add/update place actions
     - Manage action types

8. **Business Profile Performance API**
   - Endpoint Base URL: `https://businessprofileperformance.googleapis.com/v1/`
   - Purpose: Access performance metrics for business profiles
   - Key Operations:
     - Search insights
     - Impression metrics
     - User interactions
     - Driving direction requests

## Authentication and Authorization

Authentication to these APIs is managed through OAuth 2.0:

- **Required OAuth Scope**: `https://www.googleapis.com/auth/business.manage`
- **Authentication Flow**: Server-side OAuth 2.0 with refresh tokens
- **Security**: Tokens encrypted at rest using AES-256-GCM
- **Token Refresh**: Automatic refresh when tokens expire

## API Quotas and Limits

Default quotas for Google Business Profile APIs are:

- **Requests per day**: 10,000 
- **Requests per minute**: 300
- **Requests per user per minute**: 60

For production usage, increased quotas can be requested through Google Cloud Console.

## API Usage Best Practices

1. **Efficient API Usage**
   - Batch operations when possible
   - Implement caching strategies
   - Use etags for optimistic concurrency

2. **Error Handling**
   - Implement exponential backoff for rate limit errors
   - Log and monitor API errors
   - Create user-friendly fallbacks for API failures

3. **Security**
   - Store credentials securely
   - Implement principle of least privilege
   - Rotate encryption keys periodically