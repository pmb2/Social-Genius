# SocialGenius Database Configuration

SocialGenius utilizes a PostgreSQL database to store all application data. The database schema is designed to support user management, business profiles, social media account integrations, and advanced features like vectorized content for AI-driven functionalities.

## Database Schema Overview

The core tables and their relationships are as follows:

*   **`users`**: Stores user authentication details and profile information.
    *   `userId` (UUID, PK): Unique identifier for the user.
    *   `email` (VARCHAR, UNIQUE): User's email address, used for login.
    *   `password_hash` (VARCHAR): Hashed password for secure authentication.
    *   `name` (TEXT): User's full name.
    *   `profile_picture` (TEXT): URL to the user's profile picture.
    *   `phone_number` (TEXT): User's phone number.
    *   `x_account_id` (VARCHAR, UNIQUE): Linked X (formerly Twitter) account ID.
    *   `created_at`, `updated_at`, `last_login` (TIMESTAMP).

*   **`businesses`**: Stores information about each business profile managed by users.
    *   `id` (UUID, PK): Unique identifier for the business entry.
    *   `businessId` (UUID, UNIQUE): Unique identifier for the business itself.
    *   `userId` (UUID, FK to `users.userId`): The user who owns this business profile.
    *   `name` (VARCHAR): Name of the business.
    *   `status` (VARCHAR): Current status of the business (e.g., 'pending', 'active', 'noncompliant').
    *   `auth_status` (VARCHAR): Authentication status for the business (e.g., 'pending', 'logged_in', 'failed').
    *   `browser_instance` (VARCHAR): Related browser instance for automation.
    *   `created_at`, `updated_at` (TIMESTAMP).

*   **`socialAccounts`**: Stores details of linked social media accounts for businesses.
    *   `id` (UUID, PK): Unique identifier for the social account link.
    *   `userId` (UUID, FK to `users.userId`): The user who linked this account.
    *   `businessId` (UUID, UNIQUE, FK to `businesses.businessId`): The business this social account belongs to.
    *   `platform` (VARCHAR): Social media platform (e.g., 'x', 'google', 'facebook', 'instagram', 'linkedin').
    *   `providerAccountId` (VARCHAR): Unique ID from the social media provider.
    *   `accessToken` (TEXT): Encrypted access token for the social media API.
    *   `refreshToken` (TEXT): Encrypted refresh token.
    *   `expiresAt` (TIMESTAMP): Token expiration time.
    *   `metadata` (JSONB): Additional metadata from the provider.
    *   `createdAt`, `updatedAt` (TIMESTAMP).

*   **`user_settings`**: Stores user-specific application settings.
    *   `id` (UUID, PK): Unique identifier for the settings entry.
    *   `userId` (UUID, UNIQUE, FK to `users.userId`): The user these settings belong to.
    *   `planId` (VARCHAR): User's subscription plan.
    *   `apiProvider` (VARCHAR): AI API provider (e.g., 'openai').
    *   `apiEndpoint` (TEXT): API endpoint URL.
    *   `apiKey` (TEXT): Encrypted API key.
    *   `modelVersion` (VARCHAR): AI model version.
    *   `createdAt`, `updatedAt` (TIMESTAMP).

*   **`documents`**: Stores vectorized content from various sources.
    *   `id` (SERIAL, PK): Unique identifier for the document.
    *   `document_id` (TEXT, UNIQUE): External document ID.
    *   `title` (TEXT): Document title.
    *   `content` (TEXT): Raw text content of the document.
    *   `user_id` (INTEGER, FK to `users.id`): User associated with the document.
    *   `business_id` (TEXT, FK to `businesses.business_id`): Business associated with the document.
    *   `metadata` (JSONB): Document metadata.
    *   `embedding` (vector(1536)): Vector embedding of the document content.
    *   `created_at`, `updated_at` (TIMESTAMP).

*   **`memories`**: Stores business-related memories or insights.
    *   `id` (SERIAL, PK): Unique identifier for the memory.
    *   `memory_id` (TEXT): External memory ID.
    *   `business_id` (TEXT): Business associated with the memory.
    *   `content` (TEXT): Memory content.
    *   `memory_type` (TEXT): Type of memory.
    *   `is_completed` (BOOLEAN): Completion status.
    *   `embedding` (vector(1536)): Vector embedding of the memory content.
    *   `created_at` (TIMESTAMP).

*   **`sessions`**: Manages user sessions.
    *   `id` (SERIAL, PK): Unique identifier for the session.
    *   `session_id` (TEXT, UNIQUE): Session token.
    *   `user_id` (INTEGER, FK to `users.id`): User associated with the session.
    *   `expires_at` (TIMESTAMP): Session expiration time.
    *   `created_at` (TIMESTAMP).

*   **`business_credentials`**: Stores various credentials related to businesses.
    *   `id` (SERIAL, PK): Unique identifier.
    *   `business_id` (INTEGER, FK to `businesses.id`): Business associated with the credential.
    *   `credential_type` (TEXT): Type of credential.
    *   `credential_value` (TEXT): Credential value.
    *   `created_at`, `updated_at` (TIMESTAMP).

*   **`linked_accounts`**: (From migration `002_add_x_oauth.sql`) Stores details for linked X (Twitter) accounts.
    *   `id` (SERIAL, PK): Unique identifier.
    *   `user_id` (INTEGER, FK to `users.id`): User who linked the account.
    *   `business_id` (VARCHAR, UNIQUE): Business associated with the linked account.
    *   `x_account_id` (VARCHAR, UNIQUE): X account ID.
    *   `x_username` (VARCHAR): X username.
    *   `access_token` (TEXT): X access token.
    *   `refresh_token` (TEXT): X refresh token.
    *   `token_expires_at` (TIMESTAMPTZ): Token expiration.
    *   `created_at` (TIMESTAMPTZ).

## Database Initialization and Migrations

*   **Initial Schema:** The base database schema is defined in `init-db.sql` and `docker-entrypoint-initdb.d/01-init-schema.sql`. Note the discrepancy in `id` and `business_id`/`user_id` types between `init-db.sql` (SERIAL/TEXT) and `01-init-schema.sql` (UUID/UUID). The `01-init-schema.sql` appears to be the more current and robust design using UUIDs.
*   **Extensions:** `pgvector` is enabled for vector similarity search, and `pgcrypto` for data encryption.
*   **Triggers:** `updated_at` triggers are set up for `users`, `businesses`, `socialAccounts`, and `user_settings` tables to automatically update timestamps on record modification.
*   **Migrations:** Schema changes are managed through SQL migration files located in the `migrations/` directory (e.g., `002_add_x_oauth.sql`).

## PostgreSQL Client and Connection Management

*   **`pg-direct-client.js`**: A custom or fallback PostgreSQL client implementation, suggesting direct interaction with the database when the standard `pg` module's `Client` might not be available or suitable.
*   **`pg-pool-fix.js` and `pg-pool-patch.js`**: These files indicate that the project addresses specific compatibility or inheritance issues with the `pg-pool` library, ensuring proper connection pooling and `EventEmitter` functionality. This suggests a focus on robust and efficient database connections.

## Data Encryption

*   The database includes `encryptToken` and `decryptToken` functions using `pgcrypto` for encrypting sensitive data like access tokens and API keys, enhancing data security.