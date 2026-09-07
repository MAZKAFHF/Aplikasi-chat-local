"""Central configuration for LocalRoom Chat.

All tunable values live here so they are easy to change.
"""

from pathlib import Path

# --- Network ---------------------------------------------------------------
HOST = "0.0.0.0"
PORT = 8000

# --- In-memory message store ------------------------------------------------
MAX_MESSAGES = 1000

# --- Upload limits ----------------------------------------------------------
MAX_FILE_SIZE = 100 * 1024 * 1024        # 100 MB per file
MAX_TOTAL_TEMP_STORAGE = 2 * 1024 * 1024 * 1024  # 2 GB for the whole session

# --- Username ---------------------------------------------------------------
MAX_USERNAME_LENGTH = 30
MIN_USERNAME_LENGTH = 1

# --- Reconnect --------------------------------------------------------------
RECONNECT_MAX_DELAY = 5

# --- Temporary storage ------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DATA_DIR = BASE_DIR / "temp_data"
SESSIONS_DIR = TEMP_DATA_DIR / "sessions"

# --- Browser notification ---------------------------------------------------
APP_NAME = "LocalRoom Chat"

# --- Allowed upload extensions ----------------------------------------------
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
FILE_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
    ".txt", ".zip",
}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | FILE_EXTENSIONS

IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}

FILE_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".zip": "application/zip",
}
