"""LocalRoom Chat — FastAPI application entry point."""

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

from . import config
from .routers import api, upload
from .session_manager import session_manager
from .websocket_manager import manager

templates = Jinja2Templates(directory=str(config.BASE_DIR / "templates"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    session_manager.start_new_session()
    print(f"[LocalRoom] Session baru dimulai: {session_manager.session_id}")
    ping_task = None
    try:
        ping_task = asyncio.create_task(_ping_loop())
        yield
    finally:
        if ping_task:
            ping_task.cancel()
        print("[LocalRoom] Server berhenti. Data sementara akan dibersihkan pada start berikutnya.")


async def _ping_loop():
    while True:
        await asyncio.sleep(25)
        try:
            await manager.broadcast({"type": "ping"})
        except Exception:
            pass


app = FastAPI(title="LocalRoom Chat", lifespan=lifespan)

app.include_router(api.router)
app.include_router(upload.router)

app.mount("/static", StaticFiles(directory=str(config.BASE_DIR / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "login.html")


@app.get("/chat", response_class=HTMLResponse)
def chat_page(request: Request):
    return templates.TemplateResponse(request, "chat.html")


_room_router = APIRouter()


@_room_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    username = None
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except (ValueError, TypeError):
                await _send_error(websocket, "Format pesan tidak valid.")
                continue

            event_type = data.get("type")

            if event_type == "user_join":
                requested = (data.get("username") or "").strip()
                registered = manager.add_user(requested, websocket)
                if not registered:
                    await _send_error(
                        websocket,
                        "Username sedang digunakan. Silakan pilih nama lain."
                        if requested
                        else "Username tidak valid.",
                    )
                    await websocket.close()
                    return
                username = requested
                await websocket.send_text(json.dumps({
                    "type": "welcome",
                    "username": username,
                    "messages": manager.history(limit=config.MAX_MESSAGES),
                    "users": manager.online_users(),
                    "session_id": session_manager.session_id,
                }, ensure_ascii=False))
                await manager.notify_users_updated()

            elif event_type == "chat_message":
                if username is None:
                    await _send_error(websocket, "Belum terhubung sebagai pengguna.")
                    continue
                content = (data.get("content") or "").strip()
                if not content:
                    await _send_error(websocket, "Pesan tidak boleh kosong.")
                    continue
                if len(content) > 4000:
                    await _send_error(websocket, "Pesan terlalu panjang.")
                    continue
                message = manager.create_text_message(username, data.get("content"))
                await manager.broadcast({"type": "message_created", "message": message})

            elif event_type == "file_message":
                if username is None:
                    await _send_error(websocket, "Belum terhubung sebagai pengguna.")
                    continue
                meta = data.get("file")
                if not meta or not meta.get("stored_name"):
                    await _send_error(websocket, "Metadata file tidak valid.")
                    continue
                message = manager.create_media_message(username, meta)
                await manager.broadcast({"type": "message_created", "message": message})

            elif event_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if username:
            manager.remove_user(username)
            try:
                await manager.notify_users_updated()
            except Exception:
                pass


async def _send_error(websocket: WebSocket, message: str):
    await websocket.send_text(json.dumps({"type": "error", "message": message}, ensure_ascii=False))


app.include_router(_room_router)
