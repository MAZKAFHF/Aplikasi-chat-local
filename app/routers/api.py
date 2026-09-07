"""HTTP API routes: messages, users, status."""

from fastapi import APIRouter, Query

from ..session_manager import session_manager
from ..websocket_manager import manager

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/messages")
def get_messages(limit: int = Query(100, ge=0, le=1000)):
    msgs = manager.history(limit)
    return {"messages": msgs, "count": len(msgs)}


@router.get("/users")
def get_users():
    return {"users": manager.online_users()}


@router.get("/status")
def get_status():
    return {
        "session_id": session_manager.session_id,
        "online_users": len(manager.connections),
        "status": "running",
    }
