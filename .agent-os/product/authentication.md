# SocialGenius User Authentication

SocialGenius implements a flexible and secure user authentication system, supporting both traditional email/password credentials and OAuth-based logins through NextAuth.js. The system is designed to manage user sessions, protect routes, and integrate with various social media platforms.

## Authentication Mechanisms

1.  **Email and Password Authentication:**
    *   Users can register and log in using their email address and a chosen password.
    *   Password hashing is performed on the backend to securely store credentials.
    *   The `users` table in the PostgreSQL database stores `email` and `password_hash`.

2.  **OAuth Authentication (NextAuth.js):**
    *   The application leverages NextAuth.js for simplified integration with OAuth providers.
    *   The `app/auth/page.tsx` component handles the client-side initiation of OAuth flows.
    *   The `SignInModal` component facilitates social logins.
    *   The `getXOAuthUrl` function (from `@/lib/auth/x-oauth`) suggests specific integration with X (formerly Twitter) OAuth.
    *   The `linked_accounts` table (created via migration `002_add_x_oauth.sql`) stores details of linked social accounts, including `access_token` and `refresh_token`.

## User Session Management

*   **Session Handling:** User sessions are managed to maintain authenticated states across the application.
*   **Session Table:** The `sessions` table in the database stores `session_id`, `user_id`, and `expires_at`.
*   **Middleware Protection:** The `middleware.ts` file is likely responsible for protecting routes and ensuring that only authenticated users can access certain parts of the application (e.g., `/dashboard`).
*   **Client-Side Session Check:** The `useAuth` hook (from `@/lib/auth/context`) provides client-side access to user authentication status and loading states, enabling dynamic redirection based on authentication status (e.g., in `app/page.tsx` and `app/(protected)/dashboard/page.tsx`).

## Key Components and Files

*   **`app/auth/page.tsx`**: The primary authentication page, handling both login and registration forms, and initiating OAuth flows.
*   **`app/(protected)/dashboard/page.tsx`**: A protected route that checks for user authentication status and redirects to the authentication page if the session is expired or invalid.
*   **`app/providers.tsx`**: Wraps the application with `AuthProvider` (from `@/lib/auth/context`) and `ToastProvider`, making authentication context available throughout the application.
*   **`lib/auth/context.tsx`**: Defines the `AuthContext` and `AuthProvider`, providing the `user` object, `loading` state, and `checkSession` function to client-side components.
*   **`lib/auth/x-oauth.ts`**: Contains logic specific to X (Twitter) OAuth URL generation.
*   **`api/auth/register-nextauth/route.ts`**: Backend API route for user registration using NextAuth.js.
*   **`api/auth/[...nextauth]/route.ts`**: NextAuth.js catch-all route for handling various authentication callbacks and providers.
*   **`create-test-user.js`**: A script for creating test users, useful for development and testing authentication flows.

## Security Considerations

*   **Password Hashing:** Passwords are not stored in plain text; instead, their hashes are stored.
*   **Token Encryption:** Access tokens and refresh tokens for social media integrations are encrypted in the database using `pgcrypto` functions (`encryptToken`, `decryptToken`).
*   **HTTPS Enforcement:** The `app/auth/page.tsx` includes a check for HTTP protocol, warning users if the connection is not secure (unless on `localhost`).
*   **URL Parameter Clearing:** Sensitive data in URL parameters is cleared after processing to prevent exposure.
*   **Session Expiration:** Sessions have an `expires_at` timestamp, ensuring they are not valid indefinitely.

## Authentication Flow Summary

1.  **Initial Load (`app/page.tsx`):** Checks `useAuth` context. If a user is authenticated, redirects to `/dashboard`; otherwise, redirects to `/auth`.
2.  **Login/Registration (`app/auth/page.tsx`):** Users can choose to log in with email/password or sign up. OAuth options are also presented.
3.  **API Interaction:** Email/password submissions are handled by backend API routes (e.g., `/api/auth/register-nextauth`). OAuth flows are managed by NextAuth.js.
4.  **Session Establishment:** Upon successful authentication, a session is established and stored in the `sessions` table.
5.  **Protected Access:** For protected routes, `middleware.ts` verifies the session. Client-side components use `useAuth` to react to authentication state changes.