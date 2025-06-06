from dotenv import load_dotenv
load_dotenv(override=True)

import os
import asyncio
import uuid
import time
import platform
import json
import random
import logging
import pickle
import base64
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from browser_use import Agent, Browser

# Custom logging filter to suppress health check logs
class HealthCheckFilter(logging.Filter):
    def __init__(self, name=''):
        super().__init__(name)
        self.health_check_count = 0
        self.last_health_log_time = 0
        self.health_log_interval = 300  # Log only every 5 minutes (300 seconds)
    
    def filter(self, record):
        # Always allow non-health check logs
        if 'GET /health' not in record.getMessage():
            return True
            
        # For health check logs, only allow periodic logging
        current_time = time.time()
        self.health_check_count += 1
        
        # Log first health check and then only at intervals
        if self.last_health_log_time == 0 or (current_time - self.last_health_log_time) >= self.health_log_interval:
            self.last_health_log_time = current_time
            record.getMessage = lambda: f"Health check OK (suppressed {self.health_check_count} logs since last report)"
            self.health_check_count = 0
            return True
            
        # Suppress other health check logs
        return False

# Configure logging with custom filter
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("browser-api.log")
    ]
)
logger = logging.getLogger("browser-use-api")

# Add filter to suppress frequent health checks
health_filter = HealthCheckFilter()
for handler in logging.getLogger("uvicorn.access").handlers:
    handler.addFilter(health_filter)

# Initialize FastAPI app
app = FastAPI(title="Browser-Use API", description="API for browser automation using browser-use library")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.social-genius.com", "http://localhost:3000", "http://localhost:3001", "http://localhost:80", "https://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create a browser instance
# For version 0.1.40, create browser first, then configure it
browser = Browser()
# Try to set headless mode through the config
try:
    # Attempt to configure the browser
    browser.config.headless = True
except Exception as e:
    logger.warning(f"Unable to set headless mode: {str(e)}")
    # Continue anyway

# Task storage
tasks: Dict[str, Dict[str, Any]] = {}
task_cleanup_time = timedelta(hours=1)  # Clean up completed tasks after 1 hour

# Browser session storage - maintains persistent state across API calls
browser_sessions: Dict[str, Dict[str, Any]] = {}
session_dir = Path("browser_sessions")
session_dir.mkdir(exist_ok=True)

# Browser context storage 
# Maps business IDs to browser context data
browser_contexts: Dict[str, Any] = {}

# Model definitions
class QueryRequest(BaseModel):
    task: str

class QueryResponse(BaseModel):
    result: str

class GoogleAuthRequest(BaseModel):
    email: str
    password: str
    url: str = "https://accounts.google.com/ServiceLogin"
    businessId: str
    timeout: int = 90000  # 90 seconds timeout
    advanced_options: Optional[Dict[str, Any]] = None
    reuseSession: bool = True  # Whether to reuse an existing session if available

class TaskResponse(BaseModel):
    task_id: str
    status: str = "pending"

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

# Helper functions
def create_task() -> str:
    """Create a new task and return its ID"""
    task_id = str(uuid.uuid4())
    tasks[task_id] = {
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "completed_at": None,
        "result": None
    }
    return task_id

async def cleanup_old_tasks():
    """Clean up old completed tasks"""
    now = datetime.now()
    to_delete = []
    
    for task_id, task in tasks.items():
        if task["status"] in ["completed", "failed"]:
            completed_at = datetime.fromisoformat(task["completed_at"]) if task["completed_at"] else None
            if completed_at and now - completed_at > task_cleanup_time:
                to_delete.append(task_id)
    
    for task_id in to_delete:
        del tasks[task_id]

# Session management helper functions
async def save_browser_session(business_id: str, cookies: List[Dict], local_storage: Dict = None, session_storage: Dict = None, metadata: Dict = None) -> bool:
    """Save browser session data (cookies and storage) for a business ID"""
    try:
        session_data = {
            "cookies": cookies,
            "local_storage": local_storage or {},
            "session_storage": session_storage or {},
            "last_updated": datetime.now().isoformat(),
            "user_agent": browser.config.user_agent if hasattr(browser.config, "user_agent") else None,
            "metadata": metadata or {}
        }
        
        # Save in memory
        browser_sessions[business_id] = session_data
        
        # Save to disk for persistence
        session_file = session_dir / f"{business_id}.pickle"
        with open(session_file, "wb") as f:
            pickle.dump(session_data, f)
        
        # Log details about the saved session
        cookies_count = len(cookies) if cookies else 0
        storage_items = len(local_storage or {}) + len(session_storage or {})
        metadata_str = ', '.join(f"{k}: {v}" for k, v in (metadata or {}).items())
        
        logger.info(f"Saved browser session for business {business_id} with {cookies_count} cookies, {storage_items} storage items{' and metadata: ' + metadata_str if metadata else ''}")
        return True
    except Exception as e:
        logger.error(f"Error saving browser session for business {business_id}: {str(e)}")
        return False

async def load_browser_session(business_id: str) -> Optional[Dict]:
    """Load browser session data for a business ID"""
    try:
        # Check memory cache first
        if business_id in browser_sessions:
            logger.info(f"Loaded browser session from memory for business {business_id}")
            return browser_sessions[business_id]
        
        # Otherwise check disk
        session_file = session_dir / f"{business_id}.pickle"
        if not session_file.exists():
            logger.info(f"No saved browser session found for business {business_id}")
            return None
        
        # Load from disk
        with open(session_file, "rb") as f:
            session_data = pickle.load(f)
        
        # Update memory cache
        browser_sessions[business_id] = session_data
        logger.info(f"Loaded browser session from disk for business {business_id}")
        
        return session_data
    except Exception as e:
        logger.error(f"Error loading browser session for business {business_id}: {str(e)}")
        return None

async def apply_session_to_browser(browser_instance, session_data: Dict) -> bool:
    """Apply session data to a browser instance"""
    try:
        if not session_data or not session_data.get("cookies"):
            return False
        
        # Apply cookies to the browser
        for cookie in session_data["cookies"]:
            try:
                await browser_instance.page.context.add_cookies([cookie])
            except Exception as cookie_error:
                logger.warning(f"Error setting cookie: {str(cookie_error)}")
        
        # Set local storage if applicable and browser supports it
        local_storage = session_data.get("local_storage", {})
        if local_storage and hasattr(browser_instance, "page") and hasattr(browser_instance.page, "evaluate"):
            for key, value in local_storage.items():
                try:
                    await browser_instance.page.evaluate(f"localStorage.setItem('{key}', '{value}')")
                except Exception as ls_error:
                    logger.warning(f"Error setting localStorage item: {str(ls_error)}")
        
        # Set session storage if applicable and browser supports it
        session_storage = session_data.get("session_storage", {})
        if session_storage and hasattr(browser_instance, "page") and hasattr(browser_instance.page, "evaluate"):
            for key, value in session_storage.items():
                try:
                    await browser_instance.page.evaluate(f"sessionStorage.setItem('{key}', '{value}')")
                except Exception as ss_error:
                    logger.warning(f"Error setting sessionStorage item: {str(ss_error)}")
        
        logger.info(f"Applied browser session with {len(session_data['cookies'])} cookies")
        return True
    except Exception as e:
        logger.error(f"Error applying browser session: {str(e)}")
        return False

async def extract_browser_session(browser_instance) -> Dict:
    """Extract session data from a browser instance"""
    try:
        # Extract cookies
        cookies = await browser_instance.page.context.cookies()
        
        # Extract localStorage
        local_storage = {}
        try:
            local_storage = await browser_instance.page.evaluate("Object.assign({}, localStorage)")
        except Exception as ls_error:
            logger.warning(f"Error getting localStorage: {str(ls_error)}")
        
        # Extract sessionStorage
        session_storage = {}
        try:
            session_storage = await browser_instance.page.evaluate("Object.assign({}, sessionStorage)")
        except Exception as ss_error:
            logger.warning(f"Error getting sessionStorage: {str(ss_error)}")
        
        session_data = {
            "cookies": cookies,
            "local_storage": local_storage,
            "session_storage": session_storage,
            "last_updated": datetime.now().isoformat(),
            "user_agent": browser.config.user_agent if hasattr(browser.config, "user_agent") else None
        }
        
        return session_data
    except Exception as e:
        logger.error(f"Error extracting browser session: {str(e)}")
        return {"cookies": [], "local_storage": {}, "session_storage": {}}

# Regular query endpoint
@app.post("/v1/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    if not request.task:
        raise HTTPException(status_code=400, detail="Task cannot be empty")
    
    agent = Agent(
        task=request.task,
        browser=browser,
    )
    result = await agent.run()
    
    return QueryResponse(result=result.final_result())

# Health check endpoint - simplified to minimize logging impact
@app.get("/health")
async def health_check():
    # Simple response with no timestamp to reduce logging noise
    return {"status": "healthy"}

# Google authentication endpoint
@app.post("/v1/google-auth", response_model=TaskResponse)
async def google_auth(request: GoogleAuthRequest, background_tasks: BackgroundTasks):
    task_id = create_task()
    
    # Log start of authentication (no sensitive info)
    logger.info(f"Starting Google authentication task {task_id} for business {request.businessId}")
    
    # Check if we have advanced options
    advanced_options = request.advanced_options or {}
    
    # Add session handling options
    if "reuse_session" not in advanced_options:
        advanced_options["reuse_session"] = request.reuseSession
        
    if "persist_session" not in advanced_options:
        advanced_options["persist_session"] = True
    
    # Start authentication in background with enhanced session options
    background_tasks.add_task(
        perform_google_auth,
        task_id,
        request.email,
        request.password,
        request.url,
        request.businessId,
        request.timeout,
        advanced_options
    )
    
    return TaskResponse(task_id=task_id)

async def perform_google_auth(
    task_id: str,
    email: str,
    password: str,
    url: str,
    business_id: str,
    timeout: int,
    advanced_options: Optional[Dict[str, Any]] = None
):
    """Perform Google authentication in background with enhanced logging and reliability"""
    # Generate a unique trace ID for tracking this auth flow through logs
    trace_id = f"auth-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    
    # Log the start of the authentication process with trace ID
    logger.info(f"[TRACE:{trace_id}] Starting Google authentication for business {business_id}, task {task_id}")
    logger.info(f"[TRACE:{trace_id}] Authentication parameters: URL={url}, timeout={timeout}, options={advanced_options}")
    
    # Log system information
    import platform
    import psutil
    
    system_info = {
        "os": platform.system(),
        "platform": platform.platform(),
        "python": platform.python_version(),
        "cpu_count": psutil.cpu_count(),
        "memory": f"{psutil.virtual_memory().total / (1024 * 1024 * 1024):.2f} GB",
        "memory_available": f"{psutil.virtual_memory().available / (1024 * 1024 * 1024):.2f} GB",
        "docker": os.path.exists("/.dockerenv"),
    }
    logger.info(f"[TRACE:{trace_id}] System information: {system_info}")
    
    """Perform Google authentication in background with enhanced capabilities"""
    try:
        # Process advanced options with defaults
        advanced_options = advanced_options or {}
        human_delay_min = advanced_options.get("human_delay_min", 1)
        human_delay_max = advanced_options.get("human_delay_max", 3)
        max_captcha_attempts = advanced_options.get("max_captcha_attempts", 2)
        
        # Log authentication preparation steps
        logger.info(f"[TRACE:{trace_id}] Preparing authentication with enhanced anti-detection behaviors")
        
        # Enhanced Google authentication instruction that handles challenges
        auth_task = f"""
        Task: Log in to Google with specific anti-detection behaviors.
        
        IMPORTANT - FOLLOW THIS NATURAL BROWSING PATTERN:
        1. Navigate to {url}
        2. If there's a cookie consent dialog, click "I agree" or "Accept all"
        3. Wait for the page to fully load (1-3 seconds)
        4. Find the email/account identifier field, click it
        5. Type the email address slowly like a human: {email}
        6. Pause briefly (1-2 seconds) as if thinking
        7. Click "Next" or press Enter
        8. Wait for the password page to load (2-3 seconds)
        9. Find the password field and click it
        10. Type the password slowly like a human would
        11. Click "Next" or press Enter
        12. Look for any of these post-login scenarios:
        
        STEP-BY-STEP PROGRESS REPORTING:
        - After each major step (1-11), report your progress clearly
        - Use format: 'PROGRESS: Step X completed - [description]'
        - These progress markers help track the authentication flow
        - Example: 'PROGRESS: Step 4 completed - Found and clicked email field'
        
        HANDLE THESE VERIFICATION CHALLENGES:
        - If asked to confirm recovery email/phone, click "Confirm"
        - If asked "Try a different way", look for and click a "Continue" button
        - If Google asks if you want to continue with this browser, select "Yes"
        - If asked about Google cookies/tracking, click "Accept" or "I agree"
        
        DETECTING SUCCESS OR FAILURE:
        - SUCCESS: You've reached a Google account page or dashboard
        - FAILURE TYPES:
          - WRONG_PASSWORD: The password is incorrect
          - EMAIL_NOT_FOUND: The email doesn't have an account
          - SUSPICIOUS_ACTIVITY: Google detected unusual activity
          - VERIFICATION_REQUIRED: Google needs additional verification
          - TWO_FACTOR_REQUIRED: 2FA is enabled on this account
        
        Report clearly if login succeeded or exactly which type of failure occurred.
        """
        
        # Create screenshots directory for this task
        screenshots_dir = f"screenshots/{business_id}/{task_id}"
        os.makedirs(screenshots_dir, exist_ok=True)
        
        # Create a list to track critical points during authentication with timestamps
        critical_points = [
            "initial_load",
            "email_entered",
            "password_page",
            "password_entered",
            "verification_challenge",
            "completed"
        ]
        
        # Add tracking dictionary to record when each point is reached
        tracking = {
            "flow_start": datetime.now().isoformat(),
            "points_reached": {},
            "trace_id": trace_id,
            "task_id": task_id,
            "business_id": business_id,
            "steps_completed": []
        }
        logger.info(f"[TRACE:{trace_id}] Authentication flow tracking initialized at {tracking['flow_start']}")
        
        
        # Custom browser behavior that captures screenshots at critical points
        async def take_screenshot_at_point(point_name):
            try:
                # Record timestamp for this critical point
                point_time = datetime.now().isoformat()
                tracking["points_reached"][point_name] = point_time
                
                # Create screenshot path and take screenshot
                screenshot_path = f"{screenshots_dir}/{point_name}.png"
                await browser.screenshot(path=screenshot_path)
                
                # Log with trace ID for better tracking
                logger.info(f"[TRACE:{trace_id}] Captured screenshot at '{point_name}' point for task {task_id} at {point_time}")
                
                # Analyze the current page state
                try:
                    page_url = browser.page.url
                    page_title = await browser.page.title() if hasattr(browser.page, 'title') else "Unknown"
                    
                    # Log detailed page information for debugging
                    logger.info(f"[TRACE:{trace_id}] Page state at '{point_name}': URL={page_url}, Title={page_title}")
                    
                    # Check for specific elements that indicate the current flow state
                    # These selectors help determine where we are in the login flow
                    element_checks = [
                        ("#identifierId", "email_field_present"),
                        ("input[type='password']", "password_field_present"),
                        ("#challengePickerList", "challenge_picker_present"),
                        (".OVnw0d,.PrDSKc", "error_message_present"),
                    ]
                    
                    for selector, key in element_checks:
                        try:
                            element = await browser.page.querySelector(selector)
                            if element:
                                logger.info(f"[TRACE:{trace_id}] Detected '{key}' at '{point_name}' point")
                        except Exception as elem_error:
                            logger.debug(f"[TRACE:{trace_id}] Error checking for '{key}': {str(elem_error)}")
                            
                except Exception as page_error:
                    logger.warning(f"[TRACE:{trace_id}] Error analyzing page at '{point_name}': {str(page_error)}")
            except Exception as e:
                logger.warning(f"[TRACE:{trace_id}] Failed to capture screenshot at '{point_name}': {str(e)}")
                tracking["errors"] = tracking.get("errors", []) + [f"Screenshot error at {point_name}: {str(e)}"]
        
        # Create agent for this authentication task with progress tracking
        logger.info(f"[TRACE:{trace_id}] Creating Agent with authentication task")
        
        # Define a callback to extract progress information from the agent's output
        async def track_progress_callback(message: str):
            try:
                # Look for progress markers in the message
                if "PROGRESS:" in message:
                    progress_line = message.split("PROGRESS:")[1].strip().split("\n")[0]
                    logger.info(f"[TRACE:{trace_id}] 🔄 Progress update: {progress_line}")
                    tracking["steps_completed"].append({
                        "time": datetime.now().isoformat(),
                        "message": progress_line
                    })
                    
                    # Check if we can determine which step we're on
                    if "Step " in progress_line and " completed" in progress_line:
                        step_num = progress_line.split("Step ")[1].split(" ")[0]
                        if step_num.isdigit():
                            step_percent = min(90, int(step_num) * 8) # Map steps to percentage (cap at 90%)
                            tracking["progress_percent"] = step_percent
                            logger.info(f"[TRACE:{trace_id}] 📊 Progress: {step_percent}%")
                    
                # Look for error messages
                error_phrases = ["error", "failed", "couldn't", "unable to", "not found"]
                if any(phrase in message.lower() for phrase in error_phrases):
                    error_line = message.split("\n")[0] if "\n" in message else message
                    logger.warning(f"[TRACE:{trace_id}] ⚠️ Possible error in agent output: {error_line}")
                
                # Look for success indicators
                success_phrases = ["successfully logged in", "login successful", "logged in successfully", "reached google account"]
                if any(phrase in message.lower() for phrase in success_phrases):
                    logger.info(f"[TRACE:{trace_id}] ✅ Success indicator detected in agent output")
                    tracking["success_detected"] = True
                    tracking["success_message"] = message.split("\n")[0] if "\n" in message else message
            except Exception as callback_error:
                logger.error(f"[TRACE:{trace_id}] Error in progress tracking callback: {str(callback_error)}")
        
        # Create agent with progress tracking callback
        agent = Agent(
            task=auth_task,
            browser=browser
        )
        
        # Try to register the callback for messaging if the agent supports it
        try:
            if hasattr(agent, 'add_message_callback'):
                agent.add_message_callback(track_progress_callback)
                logger.info(f"[TRACE:{trace_id}] Registered progress tracking callback")
            else:
                logger.warning(f"[TRACE:{trace_id}] Agent doesn't support message callbacks - progress tracking limited")
        except Exception as callback_error:
            logger.warning(f"[TRACE:{trace_id}] Failed to register progress callback: {str(callback_error)}")
        
        # Set up custom callback for browser actions 
        # (This requires browser-use library version that supports callbacks)
        try:
            if hasattr(agent, 'add_event_listener'):
                # If browser-use has event support
                agent.add_event_listener('navigate', lambda _: take_screenshot_at_point('navigation'))
                agent.add_event_listener('input', lambda _: take_screenshot_at_point('input'))
                agent.add_event_listener('click', lambda _: take_screenshot_at_point('click'))
                logger.info("Registered screenshot event listeners")
            else:
                logger.warning("Event listeners not supported in this version of browser-use")
        except Exception as e:
            logger.warning(f"Failed to set up event listeners: {str(e)}")
        
        # Take initial screenshot
        await take_screenshot_at_point("initial")
        
        # Set a timeout for the task
        try:
            # Execute the authentication task with detailed progress logging
            logger.info(f"[TRACE:{trace_id}] 🚀 Starting authentication task with timeout of {timeout/1000} seconds")
            tracking["execution_start"] = datetime.now().isoformat()
            
            # Start a background task to periodically log progress during long-running authentication
            async def log_periodic_progress():
                try:
                    progress_count = 0
                    while True:
                        progress_count += 1
                        logger.info(f"[TRACE:{trace_id}] ⏱️ Authentication in progress - {progress_count*10} seconds elapsed")
                        await asyncio.sleep(10)  # Log every 10 seconds
                except asyncio.CancelledError:
                    logger.info(f"[TRACE:{trace_id}] Periodic progress logging stopped")
                except Exception as timer_error:
                    logger.error(f"[TRACE:{trace_id}] Error in progress timer: {str(timer_error)}")
            
            # Start the background task
            progress_task = asyncio.create_task(log_periodic_progress())
            
            try:
                # Use try/finally to ensure we always cancel the background task
                try:
                    result = await asyncio.wait_for(agent.run(), timeout=timeout/1000)
                finally:                
                    # Cancel the background task
                    progress_task.cancel()
                    try:
                        await progress_task
                    except asyncio.CancelledError:
                        pass
                
                # Record completion time
                tracking["execution_end"] = datetime.now().isoformat()
                execution_time = datetime.fromisoformat(tracking["execution_end"]) - datetime.fromisoformat(tracking["execution_start"])
                logger.info(f"[TRACE:{trace_id}] ✅ Authentication task completed in {execution_time.total_seconds():.2f} seconds")
                
                # Take final screenshot  
                await take_screenshot_at_point("completed")
                
                # Log the final result
                logger.info(f"[TRACE:{trace_id}] 📊 Authentication task result summary: {result.final_result()[:200]}...")
            except Exception as execution_error:
                # If execution itself fails, log the error
                logger.error(f"[TRACE:{trace_id}] ❌ Authentication task execution error: {str(execution_error)}")
                tracking["execution_error"] = str(execution_error)
                tracking["execution_end"] = datetime.now().isoformat()
                
                # Still try to take a final screenshot if possible
                try:
                    await take_screenshot_at_point("error_state")
                except Exception as ss_error:
                    logger.error(f"[TRACE:{trace_id}] Failed to capture error screenshot: {str(ss_error)}")
                
                # Re-raise the error
                raise
            
            # Parse the result to determine if login was successful
            final_result = result.final_result()
            logger.info(f"Authentication task {task_id} completed with result: {len(final_result)} chars")
            
            # Create a screenshots directory if it doesn't exist
            os.makedirs("screenshots", exist_ok=True)
            
            # Create timestamped screenshots folder for this task
            screenshots_dir = f"screenshots/{business_id}/{task_id}"
            os.makedirs(screenshots_dir, exist_ok=True)
            
            # Take multiple screenshots - final state and page structure
            final_screenshot_path = f"{screenshots_dir}/final_state.png"
            await agent.browser.screenshot(path=final_screenshot_path)
            
            # Try to capture DOM structure for debugging
            try:
                page_html = await agent.browser.page.content()
                with open(f"{screenshots_dir}/page_structure.html", "w") as f:
                    f.write(page_html)
                logger.info(f"Captured page HTML structure for task {task_id}")
            except Exception as e:
                logger.warning(f"Failed to capture page HTML: {str(e)}")
            
            # Log the successful screenshot capture
            logger.info(f"Screenshots saved to {screenshots_dir}")
            
            # Analyze the result for specific login outcomes
            final_result_lower = final_result.lower()
            
            # Check if authentication was successful by looking for strong success indicators
            success_indicators = [
                "successfully logged in",
                "login successful",
                "logged in successfully",
                "reached google account",
                "reached a google account page",
                "reached the google account dashboard",
                "reached the account dashboard"
            ]
            
            failure_indicators = {
                "WRONG_PASSWORD": [
                    "password is incorrect", 
                    "wrong password",
                    "password was incorrect",
                    "your password was incorrect",
                    "check your password"
                ],
                "EMAIL_NOT_FOUND": [
                    "couldn't find your google account",
                    "couldn't find account",
                    "email not found",
                    "no account found"
                ],
                "SUSPICIOUS_ACTIVITY": [
                    "unusual activity",
                    "suspicious activity",
                    "unusual sign in",
                    "suspicious login attempt",
                    "security alert",
                    "security challenge"
                ],
                "VERIFICATION_REQUIRED": [
                    "verification required",
                    "verify it's you",
                    "confirm your identity",
                    "additional verification",
                    "needs additional verification"
                ],
                "TWO_FACTOR_REQUIRED": [
                    "2-step verification",
                    "two-factor",
                    "2fa",
                    "enter verification code",
                    "enter the code"
                ],
                "ACCOUNT_DISABLED": [
                    "account disabled",
                    "account has been disabled",
                    "account suspended"
                ],
                "TOO_MANY_ATTEMPTS": [
                    "too many failed attempts",
                    "try again later",
                    "temporary lock",
                    "account is locked"
                ],
                "CAPTCHA_CHALLENGE": [
                    "captcha",
                    "security check",
                    "prove you're not a robot",
                    "recaptcha"
                ]
            }
            
            # Check for success
            if any(indicator in final_result_lower for indicator in success_indicators):
                # Success - authenticated
                logger.info(f"Authentication successful for task {task_id}, business {business_id}")
                
                # Extract and save session data for future use
                try:
                    # Get session cookies and storage
                    session_data = await extract_browser_session(agent)
                    
                    # Check if we have persist_session in options
                    persist_session = advanced_options.get("persist_session", True)
                    
                    if persist_session and session_data and session_data.get("cookies"):
                        # Save the session for future use
                        session_saved = await save_browser_session(
                            business_id,
                            session_data["cookies"],
                            session_data["local_storage"],
                            session_data["session_storage"]
                        )
                        
                        logger.info(
                            f"Session {'saved successfully' if session_saved else 'failed to save'} " +
                            f"for business {business_id} with {len(session_data['cookies'])} cookies"
                        )
                    else:
                        logger.info(f"Session persistence disabled for business {business_id}")
                        
                except Exception as session_error:
                    logger.error(f"Error saving session for business {business_id}: {str(session_error)}")
                
                # Success - authenticated
                tasks[task_id].update({
                    "status": "completed",
                    "completed_at": datetime.now().isoformat(),
                    "result": {
                        "success": True,
                        "message": "Successfully authenticated with Google",
                        "screenshot": final_screenshot_path,
                        "screenshots_dir": screenshots_dir,
                        "session_saved": True,
                        "cookies_count": len(session_data.get("cookies", [])) if 'session_data' in locals() else 0
                    }
                })
                logger.info(f"Authentication task {task_id} succeeded")
            else:
                # Analyze for specific failure reasons
                identified_error = False
                error_code = "LOGIN_FAILED"
                error_message = "Failed to log in to Google"
                
                # Check each failure indicator category
                for err_code, indicators in failure_indicators.items():
                    if any(indicator in final_result_lower for indicator in indicators):
                        error_code = err_code
                        error_message = f"Authentication failed: {err_code.replace('_', ' ').title()}"
                        identified_error = True
                        break
                
                # Record failure with reason
                tasks[task_id].update({
                    "status": "completed",
                    "completed_at": datetime.now().isoformat(),
                    "result": {
                        "success": False,
                        "error": error_message,
                        "error_code": error_code,
                        "message": error_message,
                        "screenshot": final_screenshot_path,
                        "screenshots_dir": screenshots_dir,
                        "details": final_result[:500]  # Include part of the result for debugging
                    }
                })
                logger.info(f"Authentication task {task_id} failed with code {error_code}")
                
        except asyncio.TimeoutError:
            # Handle timeout
            tasks[task_id].update({
                "status": "failed",
                "completed_at": datetime.now().isoformat(),
                "message": "Authentication task timed out",
                "result": {
                    "success": False,
                    "error": "Authentication task timed out",
                    "error_code": "TIMEOUT"
                }
            })
            logger.warning(f"Authentication task {task_id} timed out after {timeout/1000} seconds")
    
    except Exception as e:
        # Handle other errors
        error_message = str(e)
        tasks[task_id].update({
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "message": f"Error during authentication: {error_message}",
            "result": {
                "success": False,
                "error": f"Authentication task failed: {error_message}",
                "error_code": "AUTH_ERROR"
            }
        })
        logger.error(f"Authentication task {task_id} failed with exception: {error_message}", exc_info=True)

# Task status endpoint
@app.get("/v1/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    # Clean up old tasks
    await cleanup_old_tasks()
    
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = tasks[task_id]
    return TaskStatusResponse(
        task_id=task_id,
        status=task["status"],
        result=task["result"],
        message=task.get("message"),
        created_at=task["created_at"],
        completed_at=task["completed_at"]
    )

# Terminate current request
@app.get("/v1/terminate/{task_id}")
async def terminate_task(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if tasks[task_id]["status"] == "pending":
        tasks[task_id].update({
            "status": "failed",
            "completed_at": datetime.now().isoformat(),
            "message": "Task terminated by user",
            "result": {
                "success": False,
                "error": "Task terminated by user",
                "error_code": "TERMINATED"
            }
        })
        logger.info(f"Task {task_id} terminated by user request")
        return {"message": "Task terminated"}
    else:
        return {"message": f"Task is already {tasks[task_id]['status']}"}

# Screenshot listing endpoint
@app.get("/v1/screenshot/{business_id}/{task_id}")
async def list_screenshots(business_id: str, task_id: str):
    """List all screenshots for a task"""
    screenshots_dir = f"screenshots/{business_id}/{task_id}"
    
    # Check if the directory exists
    if not os.path.exists(screenshots_dir):
        raise HTTPException(status_code=404, detail="No screenshots found for this task")
    
    # List all PNG files in the directory
    try:
        screenshot_files = [
            f for f in os.listdir(screenshots_dir) 
            if f.endswith('.png')
        ]
        
        # Also include HTML files for debugging
        html_files = [
            f for f in os.listdir(screenshots_dir)
            if f.endswith('.html')
        ]
        
        return {
            "business_id": business_id,
            "task_id": task_id,
            "screenshots": screenshot_files,
            "html_files": html_files,
            "directory": screenshots_dir
        }
    except Exception as e:
        logger.error(f"Error listing screenshots: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error listing screenshots: {str(e)}")

# Get specific screenshot endpoint
@app.get("/v1/screenshot/{business_id}/{task_id}/{screenshot_name}")
async def get_screenshot(business_id: str, task_id: str, screenshot_name: str):
    """Get a specific screenshot for a task"""
    screenshot_path = f"screenshots/{business_id}/{task_id}/{screenshot_name}"
    
    # Check if the file exists
    if not os.path.exists(screenshot_path):
        raise HTTPException(status_code=404, detail="Screenshot not found")
    
    # Return the screenshot file
    try:
        return FileResponse(
            screenshot_path, 
            media_type="image/png",
            filename=f"{task_id}_{screenshot_name}"
        )
    except Exception as e:
        logger.error(f"Error retrieving screenshot: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving screenshot: {str(e)}")

# Session check endpoint
@app.get("/v1/session/{business_id}")
async def check_session(business_id: str):
    """Check if we have a valid session for the business"""
    try:
        # Load the session from memory or disk
        session = await load_browser_session(business_id)
        
        if not session:
            return {
                "has_session": False,
                "message": "No session found for this business"
            }
        
        # Get information about the session
        cookies_count = len(session.get("cookies", []))
        last_updated = session.get("last_updated", "unknown")
        
        # Simple expiration check - 7 days
        is_expired = False
        if last_updated != "unknown":
            try:
                last_updated_date = datetime.fromisoformat(last_updated)
                is_expired = (datetime.now() - last_updated_date) > timedelta(days=7)
            except:
                # If we can't parse the date, assume it's expired
                is_expired = True
        
        return {
            "has_session": True,
            "cookies_count": cookies_count,
            "last_updated": last_updated,
            "is_expired": is_expired,
            "message": "Session exists"
        }
    except Exception as e:
        logger.error(f"Error checking session for business {business_id}: {str(e)}")
        return {
            "has_session": False,
            "error": str(e),
            "message": "Error checking session"
        }

# Session validation endpoint
@app.get("/v1/session/{business_id}/validate")
async def validate_session(business_id: str, request: Request):
    """Validate if the session for the business is still working"""
    try:
        # Check for session ID in headers 
        x_session_id = request.headers.get("X-Session-ID")
        if x_session_id:
            logger.info(f"Session validation for business {business_id} includes X-Session-ID header: {x_session_id[:8]}...")
        
        # Attempt to extract session ID from cookies as well
        cookies = request.cookies
        cookie_session_id = cookies.get("session") or cookies.get("sessionId")
        if cookie_session_id:
            logger.info(f"Session validation for business {business_id} includes session cookie: {cookie_session_id[:8]}...")
        
        # Load the session
        session = await load_browser_session(business_id)
        
        if not session:
            return {
                "valid": False,
                "message": "No session found for this business"
            }
        
        # Create an agent to check the session
        validation_agent = Agent(
            task="Navigate to https://myaccount.google.com/ and check if you're still logged in",
            browser=browser
        )
        
        # Apply the session to the browser
        session_applied = await apply_session_to_browser(browser, session)
        
        if not session_applied:
            return {
                "valid": False,
                "message": "Failed to apply session to browser"
            }
        
        # Run the validation task
        validation_result = await asyncio.wait_for(validation_agent.run(), timeout=30)
        final_text = validation_result.final_result().lower()
        
        # Check if we're logged in
        is_logged_in = any(indicator in final_text for indicator in [
            "logged in",
            "google account",
            "personal info",
            "you're signed in",
            "welcome to your account"
        ])
        
        # Take screenshot for record
        screenshots_dir = "screenshots/session_validation"
        os.makedirs(screenshots_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = f"{screenshots_dir}/{business_id}_{timestamp}.png"
        await browser.screenshot(path=screenshot_path)
        
        if is_logged_in:
            # Success, update the session
            updated_session = await extract_browser_session(browser)
            
            if updated_session and updated_session.get("cookies"):
                # Save the updated session
                await save_browser_session(
                    business_id,
                    updated_session["cookies"],
                    updated_session["local_storage"],
                    updated_session["session_storage"]
                )
                
                # If we have a session ID from the headers, associate it with this session
                if x_session_id:
                    # Store metadata about the session
                    updated_session["associated_session_id"] = x_session_id
                    logger.info(f"Associated session ID {x_session_id[:8]}... with business {business_id}")
                    
                    # Update the saved session with this additional metadata
                    await save_browser_session(
                        business_id,
                        updated_session["cookies"],
                        updated_session["local_storage"],
                        updated_session["session_storage"],
                        metadata={"associated_session_id": x_session_id}
                    )
            
            return {
                "valid": True,
                "message": "Session is valid and working",
                "screenshot": screenshot_path
            }
        else:
            return {
                "valid": False,
                "message": "Session is not valid (not logged in)",
                "screenshot": screenshot_path
            }
    except Exception as e:
        logger.error(f"Error validating session for business {business_id}: {str(e)}")
        return {
            "valid": False,
            "error": str(e),
            "message": "Error validating session"
        }

# Browser status endpoint
@app.get("/v1/browser/status")
async def browser_status():
    """Get the status of the browser instance"""
    return {
        "status": "active",
        "config": {
            "headless": browser.config.headless
        },
        "uptime_seconds": (datetime.now() - datetime(1970, 1, 1)).total_seconds(),  # Dummy uptime
        "active_sessions_count": len(browser_sessions)
    }

# Start the server if running as script
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5055))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"Starting browser-use-api server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)