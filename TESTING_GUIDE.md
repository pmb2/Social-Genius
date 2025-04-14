# Testing Guide: New Features

This guide helps you test the newly integrated Browser-Use API and subscription components.

## Prerequisites

1. Make sure you've run `./setup-migrations.sh`
2. Start the application with `./start-dev.sh`
3. Ensure all containers are running with `docker ps`

## Testing Google Authentication

1. **Add a new business:**
   - Go to the Dashboard
   - Click the "+" button to add a new business
   - Select "Google Business Profile"
   - Enter business name and confirm

2. **Connect Google account:**
   - After adding a business, you'll see a "Connect Google Account" button
   - Enter Google credentials (username/password) 
   - The system should initiate a headless browser session to authenticate

3. **Verify authentication:**
   - Check the business status - it should update to "Connected" 
   - View the business details to confirm Google account connection

## Testing Subscription Features

1. **View subscription plans:**
   - Go to Settings > Subscription
   - Verify all three plans are displayed (Basic, Professional, Enterprise)
   - Confirm pricing is shown correctly

2. **Test plan selection:**
   - Select a plan (e.g., Professional)
   - Confirm the plan details appear with correct pricing 
   - Try switching between monthly and annual billing

3. **Simulate checkout:**
   - Click "Subscribe" on a plan
   - Test the credit card form with test values:
     - Card number: 4242 4242 4242 4242
     - Expiry: Any future date
     - CVC: Any 3 digits
     - ZIP: Any 5 digits

## Debugging Tips

### Browser-Use API Debugging:

1. **Check logs:**
   ```bash
   docker logs social-genius-browser-api
   ```

2. **Examine screenshots:**
   Browse the `browser-use-api/screenshots` directory where error screenshots are saved

3. **Test API endpoints directly:**
   ```bash
   # Check API health
   curl http://localhost:5055/health
   ```

### Subscription Debugging:

1. **Check JavaScript console** for any errors during plan selection or checkout

2. **Database verification:**
   ```sql
   SELECT * FROM task_logs;  -- Check automation task logs
   SELECT business_id, google_auth_status, google_email FROM businesses; -- Check Google auth status
   ```

## Expected Results

- Google authentication should successfully connect and validate credentials
- Screenshots should be captured during the process
- DB tables should contain the proper records with Google auth status
- Subscription components should display available plans
- Payment form should appear and process test payments (in test mode)