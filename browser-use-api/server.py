from dotenv import load_dotenv
load_dotenv(override=True)

import os
import asyncio
import uuid
import json
import random
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from browser_use import Agent, Browser

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("browser-api.log")
    ]
)
logger = logging.getLogger("browser-use-api")

# Initialize FastAPI app
app = FastAPI(title="Browser-Use API", description="API for browser automation using browser-use library")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Specify your allowed origins
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

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Google authentication endpoint
@app.post("/v1/google-auth", response_model=TaskResponse)
async def google_auth(request: GoogleAuthRequest, background_tasks: BackgroundTasks):
    task_id = create_task()
    
    # Log start of authentication (no sensitive info)
    logger.info(f"Starting Google authentication task {task_id} for business {request.businessId}")
    
    # Start authentication in background
    background_tasks.add_task(
        perform_google_auth,
        task_id,
        request.email,
        request.password,
        request.url,
        request.businessId,
        request.timeout,
        request.advanced_options
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
    """Perform Google authentication in background with enhanced capabilities"""
    try:
        # Process advanced options with defaults
        advanced_options = advanced_options or {}
        human_delay_min = advanced_options.get("human_delay_min", 1)
        human_delay_max = advanced_options.get("human_delay_max", 3)
        max_captcha_attempts = advanced_options.get("max_captcha_attempts", 2)
        
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
        
        # Create agent for this authentication task
        agent = Agent(
            task=auth_task,
            browser=browser
        )
        
        # Set a timeout for the task
        try:
            # Execute the authentication task
            result = await asyncio.wait_for(agent.run(), timeout=timeout/1000)
            
            # Parse the result to determine if login was successful
            final_result = result.final_result()
            logger.info(f"Authentication task {task_id} completed with result: {len(final_result)} chars")
            
            # Create a screenshots directory if it doesn't exist
            os.makedirs("screenshots", exist_ok=True)
            
            # Take a screenshot of the final state
            screenshot_path = f"screenshots/{business_id}_{task_id}.png"
            await agent.browser.screenshot(path=screenshot_path)
            
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
                tasks[task_id].update({
                    "status": "completed",
                    "completed_at": datetime.now().isoformat(),
                    "result": {
                        "success": True,
                        "message": "Successfully authenticated with Google",
                        "screenshot": screenshot_path
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
                        "screenshot": screenshot_path,
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

# Browser status endpoint
@app.get("/v1/browser/status")
async def browser_status():
    """Get the status of the browser instance"""
    return {
        "status": "active",
        "config": {
            "headless": browser.config.headless
        },
        "uptime_seconds": (datetime.now() - datetime(1970, 1, 1)).total_seconds()  # Dummy uptime
    }

# Start the server if running as script
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5055))
    host = os.environ.get("HOST", "0.0.0.0")
    logger.info(f"Starting browser-use-api server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)