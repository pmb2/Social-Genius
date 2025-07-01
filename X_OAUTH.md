# X.com OAuth Integration: Implementation Plan

This document outlines the technical implementation plan for integrating X.com OAuth for login, registration, and account linking.

## 1. High-Level Overview

The goal is to allow users to "Sign in with X" from three different contexts:
1.  **Login Page**: To log into an existing account.
2.  **Registration Page**: To create a new account.
3.  **Dashboard**: To link a new X.com account to their existing application account.

A unified OAuth callback will handle these different scenarios, identified by a `state` parameter.

## 2. Core OAuth Flow (Shared Logic)

A single set of backend logic will handle the core X.com OAuth 2.0 Authorization Code Flow.

### Environment Variables (.env)
The following new variables must be added to the `.env` file:

```
X_CLIENT_ID="YOUR_X_CLIENT_ID"
X_CLIENT_SECRET="YOUR_X_CLIENT_SECRET"
X_REDIRECT_URI="http://localhost:3000/api/auth/callback/x"
```

### Backend Route Structure
All OAuth logic will be handled under `/api/auth/x`.

-   **Initiation Route**: `GET /api/auth/x/login`
-   **Callback Route**: `GET /api/auth/x/callback`

### State Parameter
To differentiate between the three flows (login, registration, link), a `state` parameter will be used in the OAuth initiation URL. The `state` parameter will be a JWT containing the `flow` type (`login`, `register`, or `link`) and, for the `link` flow, the current user's ID.

## 3. Button-Specific Logic & Implementation

### A. Login Page – "Sign In with X"

1.  **Frontend**:
    *   The "Sign in with X" button on the login page (`/app/auth/login/page.tsx`) will link to `/api/auth/x/login?flow=login`.

2.  **Backend (`/api/auth/x/login`)**:
    *   Generate the X.com authorization URL.
    *   The `state` parameter will be a JWT with the payload `{ "flow": "login" }`.
    *   Redirect the user to the X.com authorization URL.

3.  **Backend (`/api/auth/x/callback`)**:
    *   Verify the `state` parameter and decode the JWT to identify the flow as "login".
    *   Exchange the authorization code for an access token from X.com.
    *   Fetch the user's X.com profile (ID, username, etc.).
    *   **Database Query**: Look for a user in the `users` table with a matching `x_account_id`.
    *   **If User Exists**:
        *   Generate a session token for the user.
        *   Redirect to the user's dashboard (`/app/(protected)/dashboard`).
    *   **If User Does Not Exist**:
        *   Redirect to the registration page (`/app/auth/register`) with query parameters containing the X.com profile information (e.g., `?x_id=123&x_username=handle`).
        *   The registration form will be pre-filled with this information.

### B. Registration Page – "Sign Up with X"

1.  **Frontend**:
    *   The "Sign up with X" button on the registration page (`/app/auth/register/page.tsx`) will link to `/api/auth/x/login?flow=register`.

2.  **Backend (`/api/auth/x/login`)**:
    *   Same as the login flow, but the `state` JWT will have the payload `{ "flow": "register" }`.

3.  **Backend (`/api/auth/x/callback`)**:
    *   Verify the `state` parameter and identify the flow as "register".
    *   Exchange the code for an access token and fetch the X.com profile.
    *   **Database Query**: Check if a user with the given `x_account_id` already exists.
    *   **If User Exists**:
        *   Redirect back to the registration page with an error message (e.g., `?error=x_account_exists`).
    *   **If User Does Not Exist**:
        *   Create a new, temporary user record or store the X profile in a secure, short-lived cache.
        *   Redirect the user to a "complete registration" form (`/app/auth/complete-registration`).
        *   This form will require the user to choose a unique application username and a password.
        *   Upon submission of this form, a new user record will be created in the `users` table, linking the `x_account_id`.
        *   Log the user in and redirect to the dashboard.

### C. Dashboard – "Add X Account"

1.  **Frontend**:
    *   In the user's dashboard (`/app/(protected)/dashboard/page.tsx`), the "Add X Account" button will make an API call to the backend to get the redirect URL.

2.  **Backend (`/api/auth/x/login`)**:
    *   This endpoint must be protected and only accessible by authenticated users.
    *   The `state` JWT will have the payload `{ "flow": "link", "user_id": "current_user_id" }`.
    *   Return the X.com authorization URL to the frontend.

3.  **Backend (`/api/auth/x/callback`)**:
    *   Verify the `state` parameter and identify the flow as "link". Extract the `user_id` from the JWT.
    *   Exchange the code for an access token and fetch the X.com profile.
    *   **Database Query**: Check if the fetched `x_account_id` is already linked to any user in the `linked_accounts` table.
    *   **If Already Linked**:
        *   Redirect to the dashboard with an error (`?error=x_account_linked`).
    *   **If Not Linked**:
        *   Generate a unique internal `business_id`.
        *   Insert a new record into the `linked_accounts` table, associating the `user_id`, `x_account_id`, `business_id`, and the encrypted access/refresh tokens.
        *   Redirect to the dashboard with a success message (`?success=x_account_added`).

## 4. Data Models & Database Schema

The following changes will be required in the database schema.

### `users` table
Add a nullable `x_account_id` column to the `users` table. This will be used for the primary login association.

```sql
ALTER TABLE users ADD COLUMN x_account_id VARCHAR(255) UNIQUE;
```

### `linked_accounts` table
Create a new table to store linked X.com accounts for each user.

```sql
CREATE TABLE linked_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    business_id VARCHAR(255) NOT NULL UNIQUE,
    x_account_id VARCHAR(255) NOT NULL UNIQUE,
    x_username VARCHAR(255),
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 5. Security and Error Handling

*   **Token Storage**: All OAuth tokens will be encrypted at rest in the database.
*   **State Parameter**: The `state` parameter will be a JWT signed with a secret to prevent CSRF attacks.
*   **Error Handling**: All API routes will have robust error handling to gracefully manage issues like OAuth denial, duplicate accounts, and API failures from X.com. User-facing errors will be communicated via query parameters on redirect.

## 6. Frontend Implementation Details

*   **UI Components**: New UI components will be needed for:
    *   The "Sign in with X" buttons.
    *   The "complete registration" form.
    *   Notifications/toasts for success and error messages on the dashboard.
*   **State Management**: The frontend will need to handle the different states of the OAuth flow, including waiting for the callback and displaying feedback to the user.
*   **API Service**: A new service in the frontend will be created to handle the API calls to the `/api/auth/x` endpoints.
