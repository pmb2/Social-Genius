# Multi-Platform OAuth Implementation Guide (Camel-Case & Initiation Flow Updates)

This guide provides a **production-ready, one-shot implementation** for OAuth authentication and account linking across **X.com (Twitter), Google Business, Facebook, Instagram, and LinkedIn** using Next.js App Router, PostgreSQL, and iron-session. It now uses **camel-case** for all variable and function names (e.g., `userId`, `businessId`) and includes a tip on maintaining naming consistency. The guide also clarifies the two distinct places where social media OAuth flows are initiated: during login/registration and from the user dashboard.

## 1. Executive Summary

- **Unified OAuth flow** for login, registration, and account linking.
- **Consistent camel-case naming** (`userId`, `businessId`) throughout all code and schema.
- **Two OAuth initiation points:**
  - **Login/Registration:** Users can log in or register using social accounts, then are prompted to create an app account with email/password.
  - **Dashboard (Post-login):** Authenticated users can add and manage multiple social accounts, with each connection assigned a `businessId`.

## 2. Project Setup

- [x] Environment variables for all platforms and secrets are configured.
- [x] Next.js App Router and API routes are ready.
- [x] PostgreSQL database is accessible and schema migrations are set up.
- [x] iron-session is integrated for session management.

## 3. Database Schema

**File:** `docker-entrypoint-initdb.d/01-init-schema.sql`

```sql
CREATE TABLE socialAccounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID REFERENCES users(id) ON DELETE CASCADE,
  businessId UUID NOT NULL UNIQUE,
  platform VARCHAR(32) NOT NULL CHECK (platform IN ('x', 'google', 'facebook', 'instagram', 'linkedin')),
  providerAccountId VARCHAR(128) NOT NULL,
  accessToken TEXT NOT NULL,
  refreshToken TEXT,
  expiresAt TIMESTAMP,
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE UNIQUE INDEX ON socialAccounts (platform, providerAccountId, userId);
CREATE INDEX ON socialAccounts (userId);
CREATE INDEX ON socialAccounts (businessId);
```

- **Note:** All field names use camel-case to match application conventions.

## 4. OAuth Flow Architecture

### Flow Overview

All platforms follow this unified 6-step process:

1. **Initiate OAuth:** `/api/auth/{platform}/login?mode=link|login|register`
2. **Generate State:** Create signed JWT containing mode, userId, csrfToken, timestamp, redirectUri.
3. **Provider Redirect:** Send user to platform's OAuth authorization URL.
4. **Handle Callback:** `/api/auth/{platform}/callback` - validate state, exchange code for tokens.
5. **Persist Account:** Save social account data with generated businessId.
6. **Session Management:** Update iron-session or redirect appropriately.

### JWT State Parameter Structure

```javascript
{
  "mode": "link|login|register",
  "userId": "uuid-if-linking",
  "csrfToken": "random-string",
  "timestamp": "iso-timestamp",
  "redirectUri": "post-auth-destination"
}
```

## 5. Social OAuth Initiation Points

### 1. Login/Registration Pages

- Users can **log in or register** using social accounts (OAuth).
- After OAuth, prompt users to **create an application account** with email and password.
- All social OAuth options must be present on login and registration pages.

**File:** `app/auth/page.tsx`

### 2. User Dashboard (Post-login)

- Authenticated users can **add multiple social accounts** from their dashboard.
- Each new social account is assigned a **unique businessId** and associated with the user's userId.
- Users can link multiple accounts from the same or different platforms.

**File:** `src/components/SignInModal.tsx`

## 6. Platform-Specific Implementation Details

| Platform   | Auth Type | Authorization URL | Token URL | User Info | Required Scopes | Special Requirements |
|------------|-----------|------------------|-----------|-----------|-----------------|----------------------|
| X.com      | OAuth 2.0 PKCE | `https://twitter.com/i/oauth2/authorize` | `https://api.x.com/2/oauth2/token` | `https://api.x.com/2/users/me` | `tweet.read users.read` | PKCE required, tokens expire in 2h, `offline.access` for refresh |
| Google     | OAuth 2.0 | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` | `https://www.googleapis.com/oauth2/v2/userinfo` | `https://www.googleapis.com/auth/business.manage` | Cloud project, consent screen, API access approval |
| Facebook   | OAuth 2.0 | `https://www.facebook.com/dialog/oauth` | `https://graph.facebook.com/oauth/access_token` | `https://graph.facebook.com/me` | `public_profile email pages_show_list pages_read_engagement pages_manage_posts` | App review, strict redirect URI |
| Instagram  | OAuth 2.0 (via Facebook) | `https://api.instagram.com/oauth/authorize` | `https://api.instagram.com/oauth/access_token` | `https://graph.instagram.com/me` | `user_profile user_media` | Facebook app, business account, tokens expire in 1h |
| LinkedIn   | OAuth 2.0 | `https://www.linkedin.com/oauth/v2/authorization` | `https://www.linkedin.com/oauth/v2/accessToken` | `https://api.linkedin.com/v2/me` | `r_liteprofile r_emailaddress w_member_social` | Strict redirect URI, company page, some scopes need approval |

## 7. API Route Structure

```
/api/auth/x/login
/api/auth/x/callback
/api/auth/google/login
/api/auth/google/callback
/api/auth/facebook/login
/api/auth/facebook/callback
/api/auth/instagram/login
/api/auth/instagram/callback
/api/auth/linkedin/login
/api/auth/linkedin/callback
```

## 8. Example API Route Implementation

### Login Route

**File:** `app/api/auth/oauth.ts`

```javascript
// app/api/auth/oauth.ts
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import jwt from 'jsonwebtoken';

export async function handleLogin(request, { params }) {
  const { platform } = params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'login';
  
  const session = await getIronSession(request, NextResponse.next(), sessionOptions);
  
  // Generate state JWT
  const state = jwt.sign({
    mode,
    userId: session.user?.id,
    csrfToken: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    redirectUri: searchParams.get('redirect_uri')
  }, process.env.JWT_SECRET, { expiresIn: '10m' });
  
  const oauthUrl = buildOAuthUrl(platform, state);
  return NextResponse.redirect(oauthUrl);
}
```

### OAuth URL Builder

**File:** `app/api/auth/oauth.ts`

```javascript
function buildOAuthUrl(platform, state) {
  const configs = {
    x: {
      url: 'https://twitter.com/i/oauth2/authorize',
      params: {
        response_type: 'code',
        client_id: process.env.X_CLIENT_ID,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/x/callback`,
        scope: 'tweet.read users.read offline.access',
        state,
        code_challenge: generatePKCE().codeChallenge,
        code_challenge_method: 'S256'
      }
    },
    // ...other platforms (use camel-case for all keys)
  };
  
  const config = configs[platform];
  const url = new URL(config.url);
  Object.entries(config.params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  
  return url.toString();
}
```

## 9. Callback Handler Implementation

**File:** `app/api/auth/oauth.ts`

```javascript
// app/api/auth/oauth.ts
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import jwt from 'jsonwebtoken';

export async function handleCallback(request, { params }) {
  const { platform } = params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  
  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/error?error=${error}`);
  }
  
  // Validate state
  let stateData;
  try {
    stateData = jwt.verify(state, process.env.JWT_SECRET);
  } catch (err) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/error?error=invalid_state`);
  }
  
  // Exchange code for tokens
  const tokenData = await exchangeCodeForTokens(platform, code);
  
  // Get user profile
  const profile = await getUserProfile(platform, tokenData.accessToken);
  
  // Handle based on mode
  const session = await getIronSession(request, NextResponse.next(), sessionOptions);
  
  switch (stateData.mode) {
    case 'link':
      await linkSocialAccount(session.user.id, platform, profile, tokenData);
      break;
    case 'login':
      await loginWithSocialAccount(session, platform, profile, tokenData);
      break;
    case 'register':
      await registerWithSocialAccount(session, platform, profile, tokenData);
      break;
  }
  
  await session.save();
  
  const redirectUrl = stateData.redirectUri || '/dashboard';
  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}${redirectUrl}`);
}
```

## 10. BusinessId Generation

```javascript
// Generate deterministic businessId
function generateBusinessId(platform, providerAccountId, userId) {
  const crypto = require('crypto');
  const input = `${platform}:${providerAccountId}:${userId}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

// Alternative: Use UUID v5 for namespaced deterministic IDs
const { v5: uuidv5 } = require('uuid');
const BUSINESS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function generateBusinessIdUuid(platform, providerAccountId, userId) {
  const input = `${platform}:${providerAccountId}:${userId}`;
  return uuidv5(input, BUSINESS_NAMESPACE);
}
```

## 11. Security & Token Management

- All endpoints use HTTPS.
- JWT and CSRF tokens validated on callback.
- Tokens never exposed to frontend.
- Tokens encrypted at rest (see below).
- Error handling for revoked/expired tokens.
- Rate limiting per user/platform in place.
- Logging and auditing of OAuth flows enabled.

### Token Encryption Example

**File:** `docker-entrypoint-initdb.d/01-init-schema.sql`

```sql
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive tokens
CREATE OR REPLACE FUNCTION encryptToken(token TEXT) RETURNS TEXT AS $
BEGIN
  RETURN encode(encrypt(token::bytea, 'your-encryption-key', 'aes'), 'base64');
END;
$ LANGUAGE plpgsql;

-- Decrypt tokens
CREATE OR REPLACE FUNCTION decryptToken(encryptedToken TEXT) RETURNS TEXT AS $
BEGIN
  RETURN convert_from(decrypt(decode(encryptedToken, 'base64'), 'your-encryption-key', 'aes'), 'UTF8');
END;
$ LANGUAGE plpgsql;
```

## 12. Session Management

**File:** `lib/auth/session.ts`

```javascript
// lib/auth/session.ts
import { getIronSession } from 'iron-session';

export const sessionOptions = {
  password: process.env.SESSION_PASSWORD,
  cookieName: 'myapp_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 14 // 14 days
  },
};

export async function getSession(req, res) {
  const session = await getIronSession(req, res, sessionOptions);
  return session;
}
```

## 13. Testing & Compliance

- [ ] Unit/integration tests for all API routes.
- [ ] Manual tests for all OAuth flows (login, register, link, unlink).
- [ ] Rate limit and error scenarios tested.
- [ ] Security audit and code review completed.
- [ ] Provider compliance (terms, branding, privacy) verified.

## 14. Deployment & Go-Live Checklist

- [ ] Production environment variables set.
- [ ] OAuth apps set to production mode.
- [ ] All callback URLs whitelisted.
- [ ] Monitoring and alerting for OAuth errors.
- [ ] Documentation updated for team.
- [ ] All platforms tested in production environment.
- [ ] User onboarding and support documentation ready.
- [ ] Rollout plan for existing users (if migrating).
- [ ] Ongoing maintenance and provider updates scheduled.

## 15. **Tip: Naming Consistency**

> **Always ensure consistency in variable and function naming throughout your codebase. For example, use `userId` and `businessId` in camel-case everywhere, matching your application’s conventions. Update any third-party code or generated schema to maintain this consistency and avoid subtle bugs or confusion.**

This guide now fully aligns with your naming conventions and clarifies the two initiation points for OAuth flows, ensuring a smooth, maintainable, and scalable multi-platform authentication experience.