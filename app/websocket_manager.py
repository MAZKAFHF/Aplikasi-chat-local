"""WebSocket connection manager.

Tracks active connections keyed by username, guards against duplicate
usernames, broadcasts events, and serves the in-memory message history.
"""

import asyncio
import json
import uuid
from collections import deque
from datetime import datetime

from fastapi import WebSocket

from . import config


def utcnow_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


class ConnectionManager:
    def __init__(self):
        # username -> WebSocket
        self.connections: dict[str, WebSocket] = {}
        # most recent messages, oldest dropped when full
        self.messages: deque = deque(maxlen=config.MAX_MESSAGES)

    # --- messaging ----------------------------------------------------------

    def create_text_message(self, sender: str, content: str) -> dict:
        message = {
            "id": uuid.uuid4().hex,
            "type": "text",
            "sender": sender,
            "content": content,
            "timestamp": utcnow_iso(),
        }
        self._store(message)
        return message

    def create_media_message(self, sender: str, file_meta: dict) -> dict:
        message_kind = "image" if file_meta["is_image"] else "file"
        message = {
            "id": uuid.uuid4().hex,
            "type": message_kind,
            "sender": sender,
            message_kind: {
                "original_name": file_meta["original_name"],
                "stored_name": file_meta["stored_name"],
                "url": file_meta["url"],
                "size": file_meta["size"],
                "mime_type": file_meta["mime_type"],
            },
            "timestamp": utcnow_iso(),
        }
        self._store(message)
        return message

    def _store(self, message: dict):
        self.messages.append(message)

    def history(self, limit: int | None = None) -> list:
        msgs = list(self.messages)
        if limit is not None and limit > 0:
            msgs = msgs[-limit:]
        return msgs

    # --- users --------------------------------------------------------------

    def add_user(self, username: str, websocket: WebSocket) -> bool:
        if not self._valid_username(username):
            return False
        if username in self.connections:
            return False
        self.connections[username] = websocket
        return True

    def remove_user(self, username: str):
        self.connections.pop(username, None)

    def online_users(self) -> list:
        return [{"username": u, "status": "online"} for u in sorted(self.connections)]

    @staticmethod
    def _valid_username(username: str) -> bool:
        if not username:
            return False
        if len(username) > config.MAX_USERNAME_LENGTH:
            return False
        if username.strip() != username:
            return False
        if username.isspace():
            return False
        return True

    # --- broadcast ----------------------------------------------------------

    async def broadcast(self, payload: dict):
        data = json.dumps(payload, ensure_ascii=False)
        dead = []
        for username, websocket in list(self.connections.items()):
            try:
                await websocket.send_text(data)
            except Exception:
                dead.append(username)
        for username in dead:
            self.remove_user(username)

    async def notify_users_updated(self):
        await self.broadcast({
            "type": "users_updated",
            "users": self.online_users(),
        })

    async def ping_loop(self):
        """Lightweight heartbeat to keep connections alive."""
        while True:
            await asyncio.sleep(25)
            try:
                await self.broadcast({"type": "ping"})
            except Exception:
                pass


manager = ConnectionManager()
