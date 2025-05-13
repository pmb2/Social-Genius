# Google Business Profile API Implementation Plan

## Overview

This document outlines the comprehensive plan for transitioning from browser-based automation to the official Google Business Profile API for managing business profiles in Social Genius.

## Current Situation

Currently, Social Genius uses browser automation through a custom "browser-use-api" service to:
1. Authenticate users' Google Business Profile accounts
2. Fetch business information
3. Respond to reviews
4. Create and schedule posts
5. Update business information

This approach has several limitations:
- Fragile to Google UI changes
- Potential TOS violations
- Performance and scaling issues
- Limited reliability with CAPTCHA and 2FA challenges

## Benefits of Official API Adoption

1. **Enhanced Reliability**: Direct API integration is stable and not affected by UI changes
2. **Better Performance**: API calls are faster than browser automation
3. **Improved Scalability**: Handle more clients with fewer resources
4. **Compliance**: Full adherence to Google's terms of service
5. **Extended Functionality**: Access to features not available via browser automation
6. **Reduced Maintenance**: Less code to maintain and fewer failure points

## Transition Strategy

Our migration will focus on a phased approach that prioritizes the most critical functionality first, with a fallback mechanism to the existing browser automation where API access is limited.

### Phase 1: OAuth 2.0 Implementation and Core APIs (4 weeks)

#### 1.1 Google Cloud Project Setup and API Access (Week 1)
- Create Google Cloud Project specifically for Social Genius
- Enable Google Business Profile API and related APIs
- Configure OAuth consent screen with appropriate scopes
- Set up OAuth 2.0 credentials
- Submit application for API access (processing time varies)

#### 1.2 Authentication Flow Implementation (Week 2)
- Create new `GoogleProfileAuthService` to replace browser automation login
- Implement OAuth 2.0 consent flow with proper scope requests
- Develop secure token storage with encryption
- Implement token refresh mechanism
- Create token validation and expiry monitoring
- Update UI for OAuth flow instead of username/password

#### 1.3 Business Profile Data Fetching (Week 3)
- Implement account/location discovery API integration
- Create business profile data fetch operations
- Implement data parsing and normalization
- Build cache mechanism for profile data
- Update dashboard to use API data instead of scraped content

#### 1.4 Testing and Fallback Mechanism (Week 4)
- Develop automated tests for API integration
- Create logging and monitoring for API usage
- Implement graceful fallback to browser automation when needed
- Document API rate limits and implement appropriate throttling

### Phase 2: Advanced Features and Automation (4 weeks)

#### 2.1 Review Management (Week 1-2)
- Implement review fetching via API
- Create reply-to-review functionality
- Build review analytics and reporting
- Update UI to use API-based review management

#### 2.2 Post Management (Week 2-3)
- Implement post creation via API
- Develop post scheduling capabilities
- Add support for different post types (updates, events, offers)
- Update UI for post creation/management via API

#### 2.3 Business Information Updates (Week 3-4)
- Implement location data update operations
- Add support for hours, special hours, and attributes
- Create validation for update operations
- Update UI for business information management

#### 2.4 Final Testing and Optimization (Week 4)
- Comprehensive testing across all features
- Performance optimization
- Error handling improvements
- Documentation updates

## Technical Implementation Details

### Required OAuth 2.0 Scope
```
https://www.googleapis.com/auth/business.manage
```

### Key API Endpoints to Implement

#### Authentication and Account Access
- Account discovery: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
- Location discovery: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts/{accountId}/locations`

#### Business Information
- Location details: `GET https://mybusinessinformation.googleapis.com/v1/{name=accounts/*/locations/*}`
- Update business info: `PATCH https://mybusinessinformation.googleapis.com/v1/{name=accounts/*/locations/*}`
- Attributes management: `GET/PATCH https://mybusinessinformation.googleapis.com/v1/{name=accounts/*/locations/*}/attributes`

#### Review Management
- List reviews: `GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews`
- Reply to review: `PUT https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply`

#### Post Management
- Create post: `POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts`
- Delete post: `DELETE https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts/{localPostId}`
- List posts: `GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts`

### API Environment Configuration

Add the following to our environment variables (.env):

```
# Google Business Profile API Configuration
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://your-domain.com/api/google-auth/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=your-encryption-key
GOOGLE_API_USE_FALLBACK=true
```

### Code Structure Changes

1. New Services:
   - `GoogleOAuthService` - Handles authentication flow and token management
   - `GoogleBusinessProfileService` - Core API interactions
   - `GoogleBusinessPostService` - Post management
   - `GoogleBusinessReviewService` - Review management

2. Updated Components:
   - Replace `add-business-modal.tsx` with new OAuth-based modal
   - Update dashboard profile component to work with API data
   - Modify business profile editing forms

3. New API Routes:
   - `/api/google-auth/callback` - OAuth callback handler
   - `/api/google-business/profile` - Profile data operations
   - `/api/google-business/reviews` - Review management
   - `/api/google-business/posts` - Post management

### Example OAuth Implementation (Node.js)

```typescript
// googleOAuthService.ts
import { OAuth2Client } from 'google-auth-library';
import { encryptData, decryptData } from '@/lib/utilities/crypto';
import { DatabaseService } from '@/services/database';

export class GoogleOAuthService {
  private oauth2Client: OAuth2Client;
  private db: DatabaseService;
  
  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    this.db = DatabaseService.getInstance();
  }
  
  generateAuthUrl(userId: string, businessName: string): string {
    // Store state in a secure way to prevent CSRF
    const state = Buffer.from(JSON.stringify({
      userId,
      businessName,
      timestamp: Date.now()
    })).toString('base64');
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/business.manage'],
      prompt: 'consent',
      state
    });
  }
  
  async getTokensFromCode(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }
  
  async refreshAccessToken(userId: string, businessId: string): Promise<string> {
    // Get encrypted refresh token from database
    const encryptedToken = await this.db.getRefreshToken(userId, businessId);
    
    if (!encryptedToken) {
      throw new Error('No refresh token found');
    }
    
    // Decrypt the refresh token
    const refreshToken = decryptData(
      encryptedToken,
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!
    );
    
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    
    // Update the access token in the database with new expiry
    await this.db.updateAccessToken(
      userId, 
      businessId, 
      credentials.access_token!, 
      new Date(credentials.expiry_date!)
    );
    
    return credentials.access_token!;
  }
  
  async storeTokens(userId: string, businessId: string, tokens: any): Promise<void> {
    // Encrypt the refresh token before storage
    const encryptedRefreshToken = encryptData(
      tokens.refresh_token,
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!
    );
    
    await this.db.storeTokens(
      userId,
      businessId,
      tokens.access_token,
      encryptedRefreshToken,
      new Date(tokens.expiry_date)
    );
  }
  
  async getAccessToken(userId: string, businessId: string): Promise<string> {
    // Get token info from database
    const tokenInfo = await this.db.getAccessToken(userId, businessId);
    
    if (!tokenInfo) {
      throw new Error('No token information found');
    }
    
    // Check if the token is expired
    if (new Date() > new Date(tokenInfo.expiry)) {
      // Token is expired, refresh it
      return this.refreshAccessToken(userId, businessId);
    }
    
    // Token is still valid
    return tokenInfo.accessToken;
  }
}
```

### Example Business Profile Service

```typescript
// googleBusinessProfileService.ts
import axios from 'axios';
import { GoogleOAuthService } from './googleOAuthService';

export class GoogleBusinessProfileService {
  private oauthService: GoogleOAuthService;
  
  constructor() {
    this.oauthService = new GoogleOAuthService();
  }
  
  async getAccounts(userId: string, businessId: string): Promise<any> {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.get(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching Google Business accounts:', error);
      throw error;
    }
  }
  
  async getLocations(userId: string, businessId: string, accountId: string): Promise<any> {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.get(
        `https://mybusinessaccountmanagement.googleapis.com/v1/accounts/${accountId}/locations`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching Google Business locations:', error);
      throw error;
    }
  }
  
  async getLocationDetails(userId: string, businessId: string, locationName: string): Promise<any> {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.get(
        `https://mybusinessinformation.googleapis.com/v1/${locationName}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching location details:', error);
      throw error;
    }
  }
  
  async updateLocationDetails(
    userId: string, 
    businessId: string, 
    locationName: string, 
    updateData: any,
    updateMask: string[]
  ): Promise<any> {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.patch(
        `https://mybusinessinformation.googleapis.com/v1/${locationName}?updateMask=${updateMask.join(',')}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error updating location details:', error);
      throw error;
    }
  }
}
```

### Example Business Post API Integration

```typescript
// googleBusinessPostService.ts
import axios from 'axios';
import { GoogleOAuthService } from './googleOAuthService';

export class GoogleBusinessPostService {
  private oauthService: GoogleOAuthService;
  
  constructor() {
    this.oauthService = new GoogleOAuthService();
  }
  
  async createPost(
    userId: string,
    businessId: string,
    accountId: string, 
    locationId: string, 
    postData: {
      summary: string;
      callToAction?: { actionType: string; url: string };
      media?: Array<{ mediaFormat: string; sourceUrl: string }>;
      topicType: string;
    }
  ) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.post(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
        {
          languageCode: 'en-US',
          ...postData
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating Google Business post:', error);
      throw error;
    }
  }
  
  async getPosts(
    userId: string,
    businessId: string,
    accountId: string,
    locationId: string
  ) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.get(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching Google Business posts:', error);
      throw error;
    }
  }
  
  async deletePost(
    userId: string,
    businessId: string,
    postName: string
  ) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.delete(
        `https://mybusiness.googleapis.com/v4/${postName}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error deleting Google Business post:', error);
      throw error;
    }
  }
}
```

### Review Management Service

```typescript
// googleBusinessReviewService.ts
import axios from 'axios';
import { GoogleOAuthService } from './googleOAuthService';

export class GoogleBusinessReviewService {
  private oauthService: GoogleOAuthService;
  
  constructor() {
    this.oauthService = new GoogleOAuthService();
  }
  
  async getReviews(
    userId: string,
    businessId: string,
    accountId: string,
    locationId: string,
    pageSize = 50,
    pageToken?: string,
    orderBy?: string
  ) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const queryParams = new URLSearchParams();
      queryParams.append('pageSize', pageSize.toString());
      
      if (pageToken) {
        queryParams.append('pageToken', pageToken);
      }
      
      if (orderBy) {
        queryParams.append('orderBy', orderBy);
      }
      
      const response = await axios.get(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching Google Business reviews:', error);
      throw error;
    }
  }
  
  async replyToReview(
    userId: string,
    businessId: string,
    accountId: string,
    locationId: string,
    reviewId: string,
    replyText: string
  ) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.put(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
        {
          comment: replyText
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error replying to Google Business review:', error);
      throw error;
    }
  }
  
  async deleteReviewReply(
    userId: string,
    businessId: string,
    accountId: string,
    locationId: string,
    reviewId: string
  ) {
    try {
      const accessToken = await this.oauthService.getAccessToken(userId, businessId);
      
      const response = await axios.delete(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error deleting Google Business review reply:', error);
      throw error;
    }
  }
}
```

## UI Implementation for OAuth Flow

### New Add Business Modal with OAuth

Replace the current username/password form with a "Sign in with Google" button that initiates the OAuth flow:

```tsx
// New OAuth-based add-business-modal.tsx
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AddBusinessModal({ isOpen, onClose, onSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [step, setStep] = useState(1);
  
  const handleNext = () => {
    if (!businessName.trim()) {
      alert('Please enter a business name');
      return;
    }
    setStep(2);
  };
  
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    
    try {
      // Get auth URL from backend
      const response = await fetch('/api/google-auth/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessName: businessName.trim()
        }),
        credentials: 'include'
      });
      
      const { url } = await response.json();
      
      // Open OAuth popup or redirect
      window.location.href = url;
    } catch (error) {
      console.error('Error initiating Google sign-in:', error);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <Dialog.Content className="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>
            {step === 1 ? 'Add Business' : 'Connect Google Business Profile'}
          </Dialog.Title>
          <Dialog.Description>
            {step === 1 
              ? 'Enter your business details below.'
              : 'Connect your Google Business Profile to manage it through Social Genius.'}
          </Dialog.Description>
        </Dialog.Header>
        
        {step === 1 ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Business Name"
              />
            </div>
            
            <Dialog.Footer>
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button onClick={handleNext}>
                Next
              </Button>
            </Dialog.Footer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6">
            <img 
              src="/google-business-profile-logo.png" 
              alt="Google Business Profile" 
              className="w-24 h-24 mb-4"
            />
            
            <p className="text-center text-sm text-gray-600 mb-6">
              Click the button below to sign in with your Google account and authorize access to your Business Profile.
            </p>
            
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 px-4 rounded-md w-full"
            >
              <img src="/google-logo.svg" alt="Google" className="w-5 h-5" />
              {isLoading ? "Connecting..." : "Sign in with Google"}
            </Button>
            
            <div className="mt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={isLoading}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
```

## Backend OAuth Handler

Create new API routes to handle the OAuth flow:

### URL Generation Endpoint

```typescript
// /app/api/google-auth/url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google-oauth-service';
import { AuthService } from '@/services/auth-service';

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const authService = AuthService.getInstance();
    const session = await authService.getSessionFromRequest(req);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Get business name from request body
    const body = await req.json();
    const { businessName } = body;
    
    if (!businessName) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }
    
    // Generate OAuth URL
    const oauthService = new GoogleOAuthService();
    const url = oauthService.generateAuthUrl(userId, businessName);
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}
```

### OAuth Callback Endpoint

```typescript
// /app/api/google-auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthService } from '@/services/google-oauth-service';
import { GoogleBusinessProfileService } from '@/services/google-business-profile-service';
import { DatabaseService } from '@/services/database-service';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  if (!code || !state) {
    return NextResponse.redirect('/dashboard?error=auth_failed');
  }
  
  try {
    // Decode state parameter
    const stateData = JSON.parse(
      Buffer.from(state, 'base64').toString('utf-8')
    );
    
    const { userId, businessName, timestamp } = stateData;
    
    // Validate state (optional: check timestamp not too old)
    const now = Date.now();
    if (now - timestamp > 1000 * 60 * 10) { // 10 minute expiry
      return NextResponse.redirect('/dashboard?error=auth_expired');
    }
    
    // Exchange code for tokens
    const oauthService = new GoogleOAuthService();
    const tokens = await oauthService.getTokensFromCode(code);
    
    // Use the access token to get account information
    const profileService = new GoogleBusinessProfileService();
    
    // Create a temporary businessId for token storage before actual business creation
    const tempBusinessId = `temp_${Date.now()}`;
    
    // Store tokens
    await oauthService.storeTokens(userId, tempBusinessId, tokens);
    
    // Get account info
    const accountsData = await profileService.getAccounts(tokens.access_token);
    
    if (!accountsData || !accountsData.accounts || accountsData.accounts.length === 0) {
      console.error('No Google Business accounts found');
      return NextResponse.redirect('/dashboard?error=no_business_accounts');
    }
    
    // Assume we use the first account (can be enhanced to let user choose)
    const account = accountsData.accounts[0];
    
    // Get locations for this account
    const locationsData = await profileService.getLocations(
      tokens.access_token,
      account.name
    );
    
    if (!locationsData || !locationsData.locations || locationsData.locations.length === 0) {
      console.error('No locations found for account');
      return NextResponse.redirect('/dashboard?error=no_locations');
    }
    
    // Create business record in database
    const db = DatabaseService.getInstance();
    const business = await db.createBusiness({
      userId,
      name: businessName,
      googleAccountId: account.name,
      googleAccountName: account.accountName,
      primaryLocation: locationsData.locations[0].name,
      locationCount: locationsData.locations.length,
      authMethod: 'oauth',
    });
    
    // Update tokens to use the new businessId
    await oauthService.migrateTokens(userId, tempBusinessId, business.id);
    
    // Redirect to dashboard with success message
    return NextResponse.redirect('/dashboard?success=business_connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect('/dashboard?error=auth_error');
  }
}
```

## Data Storage and Security Considerations

1. Token Storage:
   - Store refresh tokens with AES-256-GCM encryption
   - Store access tokens in memory or short-lived session storage only
   - Implement key rotation for encryption keys

2. Permission Management:
   - Create a permissions model for which users can access which business profiles
   - Implement role-based access controls

3. Rate Limiting:
   - Implement API rate limits according to Google's specifications
   - Create a token bucket algorithm for fair distribution of API calls

## Fallback Strategy

In cases where API access is not available or fails:

1. Implement a feature detection mechanism to determine if the official API is accessible for a specific business profile
2. Create a `FeatureFlagService` to conditionally use browser automation
3. Log and monitor API failures to identify patterns
4. Provide transparent communication to users about which access method is being used

## Testing and Monitoring

1. Create comprehensive test suite for API integrations
2. Implement monitoring for:
   - API call success rates
   - Token refresh cycles
   - Error patterns
   - Performance metrics

2. Set up alerting for:
   - API quota approaching limits
   - Authentication failures
   - Unusual error rates

## Migration Timeline and Priorities

### Critical Path Items
1. OAuth authorization flow (highest priority)
2. Access token management and refresh
3. Basic business information retrieval
4. Review management
5. Post creation and scheduling

### Rollout Strategy
1. Develop APIs in parallel with existing functionality
2. Roll out to development environment
3. Internal testing with team accounts
4. Beta testing with selected customers
5. Full rollout with browser automation fallback
6. Phase out browser automation as API coverage increases

## Database Schema Changes

New tables required for storing OAuth tokens and API-related data:

```sql
-- Google OAuth tokens
CREATE TABLE google_oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  access_token TEXT,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Google Business account data
CREATE TABLE google_business_accounts (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  google_account_id TEXT NOT NULL,
  google_account_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Google Business locations
CREATE TABLE google_business_locations (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id),
  google_account_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  location_name TEXT NOT NULL,
  address JSON,
  phone_number TEXT,
  primary_category TEXT,
  website_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Conclusion

This implementation plan provides a comprehensive roadmap for migrating from browser automation to the official Google Business Profile API. By following this phased approach, we can ensure a smooth transition with minimal disruption to users while significantly improving reliability, performance, and compliance with Google's terms of service.

The transition will require careful planning and coordination, particularly around OAuth authentication and secure token management. However, the benefits in terms of reliability, performance, and compliance make this effort worthwhile.

After full implementation, we will have a more stable, scalable system that provides better user experience and enables future feature expansion that wouldn't be possible with browser automation.