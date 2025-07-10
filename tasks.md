## tasks.md

### 🎯 Objective

Enable seamless integration of **X.com OAuth login** for connecting and managing multiple business accounts within our application's dashboard. Each OAuth login should:

* Retrieve all relevant business data from X.com upon successful redirect.
* Store the data in our database.
* Associate each business account with the correct user in our system.
* Display all connected accounts in the user's dashboard table.
* Allow users to repeat the process to connect multiple X.com accounts.

---

### ✅ What’s Working

* OAuth flow with X.com is successfully initiating and completing.
* Redirect after login is functioning correctly and lands user on the dashboard.
* User session remains authenticated in our app after redirect.
* "Add a Business" button triggers the OAuth flow properly.

---

### ❌ Current Problems

* Data from X.com (via OAuth and API) is not being saved into the database.
* Business account records are not showing on the user dashboard.
* 401 Unauthorized errors occurring when attempting to hit X.com API endpoints.
* No businessId-userId associations being formed.

---

### 🧪 Things We've Tried

* Verified OAuth redirect URIs are correct and match X.com dev settings.
* Confirmed OAuth code is being received and redirect works.
* Attempted to access X.com APIs after redirect, received 401s.
* Verified basic token retrieval logic.

---

### 🧩 Assumptions

* API endpoint like `GET /v1/businesses/me` is available and token-scoped.
* OAuth flow includes access to a valid `access_token` for authenticated API calls.
* Each X.com account is unique and should be represented by a distinct business ID.
* A single user can add and manage multiple X.com accounts.

---

### 🛠️ Step-by-Step Implementation Checklist

#### OAuth Flow & Token Handling

* [x] Ensure correct scopes are requested (e.g., `read:business`, `read:account`).
* [x] On redirect, capture `code` and exchange for `access_token` & `refresh_token`.
* [x] Validate and securely store tokens in backend.

#### X.com API Data Fetch

* [x] Use `access_token` to fetch business data.

    * [x] Example: `GET /v1/businesses/me`
    * [x] Ensure Authorization header is set to `Bearer <token>`
* [ ] Log and inspect full response for required fields.

#### Database Integration

* [x] Create schema/model for business accounts if not already present.

    * Fields: `business_id`, `user_id`, `x_account_id`, `name`, `profile_img`, `followers`, etc.
* [x] Insert or update business data on successful API response.
* [x] Associate each business record with the current `user_id`.

#### Dashboard & UI

* [x] After login or redirect and DB insert, fetch all business accounts for the user.
* [ ] Display business accounts in dashboard table.
* [ ] Handle UI edge cases (duplicate accounts, failed inserts, etc).

#### Multi-Account Support

* [x] Allow repeated OAuth flows without overriding previous data.
* [x] Each new connection should result in a new row in the business accounts table.

#### Logging & Error Handling

* [x] Enable logging for all API requests/responses.
* [x] Capture and store 401 error payloads for debugging.
* [ ] Refresh token if expired or handle invalid token scenarios.

---

### 🧰 Next Steps

* [ ] Collect trace logs showing 401s.
* [ ] Validate OAuth `scope` and token exchange endpoint.
* [ ] Confirm which X.com API endpoints you're attempting to call.try a
* [ ] Ensure Authorization headers and token structure are correct.

---
Use this as a guide and update it and mark things as they get completed. 

### Summary of Findings:

The X.com OAuth flow is initiated from the "Add a Business" button in the dashboard.

*   **UI Entry Point:** `src/components/business/profile/dashboard-oauth.tsx` contains the `handleConnectXAccount` function which redirects the user to the backend.
*   **OAuth URL Generation:** The frontend calls `getXOAuthUrl` in `src/lib/auth/x-oauth.ts`.
*   **Authorization URL Construction:** The `getXOAuthUrl` function makes a request to `app/api/auth/x/login/route.ts`, which constructs the full authorization URL with PKCE parameters and redirects the user to X.com.
*   **Callback Handling:** After authorization, the user is redirected to `app/api/auth/callback/x/route.ts` (as defined by `X_REDIRECT_URI` in the `.env` file).
*   **Likely Point of Failure:** The callback handler at `app/api/auth/callback/x/route.ts` successfully exchanges the authorization `code` for an `access_token`. However, the database transaction that follows, which calls `db.addBusinessForUser()` and `db.addLinkedAccount()`, appears to be failing. This prevents the new business and the X.com account from being saved to the database, which is the root cause of the issues described. The 401 errors are a symptom of the tokens not being persisted correctly.

### Next Steps:
Focus on debugging the database transaction inside `app/api/auth/callback/x/route.ts`. Specifically, we need to:
1.  Add detailed logging within the `try...catch` block to capture the exact error from `db.addBusinessForUser()` or `db.addLinkedAccount()`.
2.  Inspect the `DatabaseService` methods (`addBusinessForUser` and `addLinkedAccount`) to ensure they are correctly implemented and match the database schema.
3.  Verify the data being passed to these methods is in the correct format.
