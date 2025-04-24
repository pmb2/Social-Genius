"""
API endpoints for the GBP Compliance Engine

This module provides API endpoints for triggering compliance checks,
retrieving compliance reports, and handling user input for compliance issues.
"""

import json
import logging
import asyncio
from django.http import JsonResponse, HttpResponseNotFound, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.cache import cache

from gbp_django.models import Business
from gbp_django.utils.compliance_engine.supervisor import supervisor_agent
from gbp_django.utils.logging_utils import log_compliance_action

# Configure logging
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


@require_http_methods(["GET"])
def get_compliance_data(request, business_id):
    """
    API endpoint to retrieve compliance data for a business.

    Args:
        request: The HTTP request
        business_id: The ID of the business

    Returns:
        JsonResponse containing the compliance data
    """
    logging.info(f"🔍 [COMPLIANCE API] Starting compliance data retrieval for business_id: {business_id}")

    try:
        logging.info(f"🔍 [COMPLIANCE API] Retrieving business from database for business_id: {business_id}")
        business = Business.objects.get(business_id=business_id)
        logging.info(f"✅ [COMPLIANCE API] Retrieved business: {business.business_name} ({business.business_id})")

        # Check if we have a cached compliance report
        cache_key = f"compliance_report_{business_id}"
        cached_report = cache.get(cache_key)

        if cached_report:
            logging.info(f"🔍 [COMPLIANCE API] Using cached compliance report")
            return JsonResponse(cached_report)

        # Run a new compliance check
        logging.info(f"🔍 [COMPLIANCE API] No cached report found, running new compliance check")

        # Run the compliance check asynchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            compliance_data = loop.run_until_complete(supervisor_agent.run_compliance_check(business_id))
        finally:
            loop.close()

        # Cache the compliance report for 1 hour
        cache.set(cache_key, compliance_data, 3600)

        logging.info(f"✅ [COMPLIANCE API] Compliance check completed")
        return JsonResponse(compliance_data)

    except Business.DoesNotExist:
        logging.warning(f"⚠️ [COMPLIANCE API] Business not found for business_id: {business_id}")
        return JsonResponse({"error": "Business not found."}, status=404)
    except Exception as e:
        logging.exception(f"❌ [COMPLIANCE API] Unexpected error for business_id: {business_id}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def submit_user_input(request, business_id):
    """
    API endpoint to receive user input for a compliance issue.

    Args:
        request: The HTTP request
        business_id: The ID of the business

    Returns:
        JsonResponse containing the result of processing the user input
    """
    logging.info(f"💬 [USER INPUT API] Received user input submission for business_id: {business_id}")

    try:
        data = json.loads(request.body)
        issue_id = data.get('issue_id')
        user_input = data.get('input')

        if not issue_id or not user_input:
            logging.warning(f"⚠️ [USER INPUT API] Missing required parameters for business_id: {business_id}")
            return JsonResponse({
                "status": "error",
                "message": "Missing required parameters: issue_id or input"
            }, status=400)

        # Process the user input
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                supervisor_agent.process_user_input(business_id, issue_id, user_input)
            )
        finally:
            loop.close()

        # Invalidate the cached compliance report
        cache_key = f"compliance_report_{business_id}"
        cache.delete(cache_key)

        logging.info(f"✅ [USER INPUT API] Successfully processed user input for business_id: {business_id}")
        return JsonResponse(result)

    except json.JSONDecodeError:
        logging.warning(f"⚠️ [USER INPUT API] Invalid JSON data for business_id: {business_id}")
        return JsonResponse({
            "status": "error",
            "message": "Invalid JSON data"
        }, status=400)
    except Exception as e:
        logging.exception(f"❌ [USER INPUT API] Unexpected error for business_id: {business_id}")
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def trigger_compliance_check(request, business_id):
    """
    API endpoint to manually trigger a compliance check for a business.

    Args:
        request: The HTTP request
        business_id: The ID of the business

    Returns:
        JsonResponse containing the status of the triggered compliance check
    """
    logging.info(f"🔄 [COMPLIANCE API] Manually triggering compliance check for business_id: {business_id}")

    try:
        business = Business.objects.get(business_id=business_id)

        # Invalidate any cached compliance report
        cache_key = f"compliance_report_{business_id}"
        cache.delete(cache_key)

        # Trigger the compliance check asynchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Just start the check, don't wait for it to complete
            asyncio.ensure_future(supervisor_agent.run_compliance_check(business_id))
        finally:
            loop.close()

        logging.info(f"✅ [COMPLIANCE API] Successfully triggered compliance check for business_id: {business_id}")
        return JsonResponse({
            "status": "success",
            "message": "Compliance check triggered successfully"
        })

    except Business.DoesNotExist:
        logging.warning(f"⚠️ [COMPLIANCE API] Business not found for business_id: {business_id}")
        return JsonResponse({
            "status": "error",
            "message": "Business not found"
        }, status=404)
    except Exception as e:
        logging.exception(f"❌ [COMPLIANCE API] Unexpected error for business_id: {business_id}")
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)
