"""
GET /api/stream  — Server-Sent Events endpoint.

The browser connects once and keeps the connection open.
Events are pushed whenever policy_runs, waste_resources, or
remediation_actions rows change in Postgres.

Event types:
  run_updated      { id, status, resources_found, estimated_monthly_waste, ... }
  resource_added   { subscription_id, policy_name, category, count }
  action_updated   { id, action_type, status, resource_name }
  summary_changed  {}  — tells the UI to refetch analytics/summary
"""

import uuid
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.core.notify import event_stream

router = APIRouter()


@router.get("")
async def stream(request: Request):
    """
    Server-Sent Events stream. One persistent connection per browser tab.
    No auth required — the same CORS policy as the rest of the API applies.
    """
    client_id = str(uuid.uuid4())

    async def generator():
        async for chunk in event_stream(client_id):
            # If the client disconnected, stop generating
            if await request.is_disconnected():
                break
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering for SSE
            "Connection": "keep-alive",
        },
    )
