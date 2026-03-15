"""
Postgres LISTEN/NOTIFY broadcaster for Server-Sent Events.

Architecture:
  - One shared asyncpg connection per API pod holds LISTEN on the
    "custodian" channel.
  - Postgres triggers fire NOTIFY whenever policy_runs or waste_resources
    rows are inserted or updated.
  - The broadcaster fans every notification out to all connected SSE clients
    (one asyncio.Queue per client).
  - FastAPI's /api/stream endpoint yields from that queue as SSE text.

Channel name  : custodian
Payload format: JSON string  {"type": "run_updated"|"resource_added"|"action_updated", ...}
"""

import asyncio
import asyncpg
import json
import logging
import os
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# ── Global state ──────────────────────────────────────────────────────────────
# Keyed by client id → asyncio.Queue
_clients: dict[str, asyncio.Queue] = {}
_listener_task: asyncio.Task | None = None
_listener_conn: asyncpg.Connection | None = None

CHANNEL = "custodian"


def _plain_dsn() -> str:
    """Return a plain asyncpg-compatible DSN (no +asyncpg driver prefix)."""
    return (
        os.getenv(
            "DATABASE_URL",
            "postgresql://custodian:custodian_secret@postgres-svc:5432/custodian",
        )
        .replace("postgresql+asyncpg://", "postgresql://")
    )


# ── Listener ──────────────────────────────────────────────────────────────────

def _on_notify(connection, pid, channel, payload):
    """Called by asyncpg from the event loop when a NOTIFY arrives."""
    logger.debug(f"NOTIFY on {channel}: {payload[:120]}")
    for q in list(_clients.values()):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass  # slow client — drop rather than block


async def _listener_loop():
    """Maintain the persistent LISTEN connection with auto-reconnect."""
    global _listener_conn
    backoff = 1
    while True:
        try:
            _listener_conn = await asyncpg.connect(_plain_dsn())
            await _listener_conn.add_listener(CHANNEL, _on_notify)
            logger.info(f"LISTEN on Postgres channel '{CHANNEL}'")
            backoff = 1
            # Keep alive — asyncpg fires _on_notify from the event loop
            while True:
                await asyncio.sleep(30)
                # Send a keepalive ping to the connection
                await _listener_conn.execute("SELECT 1")
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning(f"LISTEN connection lost: {exc} — reconnecting in {backoff}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)
        finally:
            if _listener_conn and not _listener_conn.is_closed():
                try:
                    await _listener_conn.remove_listener(CHANNEL, _on_notify)
                    await _listener_conn.close()
                except Exception:
                    pass
            _listener_conn = None


# ── Lifecycle ─────────────────────────────────────────────────────────────────

async def start_listener():
    """Start the background LISTEN task. Called from FastAPI lifespan."""
    global _listener_task
    _listener_task = asyncio.create_task(_listener_loop())
    logger.info("SSE broadcaster started")


async def stop_listener():
    """Gracefully shut down. Called from FastAPI lifespan."""
    global _listener_task
    if _listener_task:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
    logger.info("SSE broadcaster stopped")


# ── Client subscription ───────────────────────────────────────────────────────

async def subscribe(client_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _clients[client_id] = q
    logger.debug(f"SSE client connected: {client_id} (total={len(_clients)})")
    return q


def unsubscribe(client_id: str):
    _clients.pop(client_id, None)
    logger.debug(f"SSE client disconnected: {client_id} (total={len(_clients)})")


# ── Manual publish (used by API mutations to push immediate updates) ──────────

async def publish(event_type: str, payload: dict):
    """
    Push an event directly from the API without waiting for a Postgres NOTIFY.
    Used for instant feedback on mutations (e.g. policy toggle, exemption change).
    """
    msg = json.dumps({"type": event_type, **payload})
    for q in list(_clients.values()):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass


# ── SSE generator ─────────────────────────────────────────────────────────────

async def event_stream(client_id: str) -> AsyncGenerator[str, None]:
    """
    Async generator yielding SSE-formatted strings.
    Yields a heartbeat comment every 25s to keep proxies from closing the
    connection and to let the client detect disconnects quickly.
    """
    q = await subscribe(client_id)
    try:
        yield ": connected\n\n"   # initial comment — tells browser SSE is live
        while True:
            try:
                payload = await asyncio.wait_for(q.get(), timeout=25.0)
                # SSE format: "data: <json>\n\n"
                yield f"data: {payload}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat — SSE comment lines start with ":"
                yield ": heartbeat\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        unsubscribe(client_id)
