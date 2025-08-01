# SocialGenius Core Features

SocialGenius is built around several core functionalities to provide a comprehensive social media management experience:

## 1. Business Profile Management

*   **Creation and Management:** Users can add, view, and manage multiple business profiles. Each business profile includes details such as name, status (e.g., compliant, noncompliant, active), description, industry, website, and logo.
*   **Status Tracking:** The dashboard provides an overview of business profiles, including counts for noncompliant, compliant, and active businesses, along with a completion rate.
*   **Subscription Limits:** The system enforces subscription-based limits on the number of business locations a user can manage, prompting upgrades when limits are reached.

## 2. Social Account Integration

*   **Multi-Platform Support:** Integrates with various social media platforms (e.g., X/Twitter, Google, Facebook, Instagram, LinkedIn) to allow users to connect their business accounts.
*   **OAuth Flow:** Utilizes OAuth for secure authentication and authorization with social media platforms, managing access and refresh tokens.
*   **Account Linking:** Businesses can link their social media accounts, with the system tracking authentication status (e.g., logged_in, pending, failed) for each linked account.

## 3. User Authentication and Authorization

*   **Credential-based Authentication:** Supports traditional email and password login/registration.
*   **OAuth Authentication:** Integrates with NextAuth.js for streamlined authentication via social providers.
*   **Session Management:** Manages user sessions to maintain authenticated states across the application.
*   **Protected Routes:** Implements protected routes (e.g., `/dashboard`) that require user authentication.

## 4. Data Storage and Management

*   **PostgreSQL Database:** Uses PostgreSQL as the primary data store.
*   **Schema Design:** Key tables include `users`, `businesses`, `socialAccounts`, `sessions`, `user_settings`, `documents`, and `memories`.
*   **UUIDs for Primary Keys:** Employs UUIDs for primary keys in core tables (`users`, `businesses`, `socialAccounts`, `user_settings`) for distributed and scalable identification.
*   **Vector Embeddings:** Utilizes the `pgvector` extension for storing and querying vector embeddings, enabling advanced features like semantic search for documents and memories.
*   **Data Encryption:** Incorporates `pgcrypto` and custom functions for encrypting and decrypting sensitive data, such as API keys and tokens.
*   **Migrations:** Database schema changes are managed through SQL migration scripts (e.g., `002_add_x_oauth.sql`).

## 5. API Endpoints

*   **RESTful API:** Provides a comprehensive set of API endpoints (e.g., `/api/auth`, `/api/businesses`, `/api/google-business`, `/api/memories`, `/api/notifications`, `/api/user`) for interacting with the backend services.
*   **Data Processing:** Includes endpoints for processing various data types, such as documents (`/api/process-docx`, `/api/process-pdf`) and URLs (`/api/process-url`), and for generating vector embeddings (`/api/vectorize`).

## 6. User Interface (Frontend)

*   **React/Next.js:** Built with React and the Next.js framework for a modern, performant, and scalable web application.
*   **Component-Based Architecture:** Utilizes a modular component structure for UI elements (e.g., `BusinessProfileDashboard`, `SignInModal`, `ProfileSettingsTile`).
*   **Responsive Design:** Designed to be responsive and accessible across different devices.
*   **State Management:** Manages UI state using React hooks and context (e.g., `useAuth` context).

## 7. Development and Deployment

*   **Docker Integration:** Uses Docker for containerization, facilitating consistent development and deployment environments.
*   **Patching and Fixes:** Includes custom patches and fixes for external libraries (e.g., `pg-pool`) to ensure stability and compatibility.