"""Session lifecycle: create/persist a session id and clean old sessions.

Every server start produces a new session id, clears leftover temporary
sessions from a previous run, and creates fresh image/file folders.
"""

import shutil
import uuid

from . import config


class SessionManager:
    def __init__(self):
        self.session_id = None
        self.images_dir = None
        self.files_dir = None

    def start_new_session(self):
        """Clean any old sessions and initialize a brand-new one."""
        self._cleanup_old_sessions()
        self.session_id = uuid.uuid4().hex
        self.images_dir = self._ensure_dir(config.SESSIONS_DIR / self.session_id / "images")
        self.files_dir = self._ensure_dir(config.SESSIONS_DIR / self.session_id / "files")
        return self.session_id

    def _cleanup_old_sessions(self):
        """Remove every leftover session folder from a previous server run."""
        if not config.SESSIONS_DIR.exists():
            config.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
            return
        for child in config.SESSIONS_DIR.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
            else:
                try:
                    child.unlink()
                except OSError:
                    pass

    @staticmethod
    def _ensure_dir(path):
        path.mkdir(parents=True, exist_ok=True)
        return path


session_manager = SessionManager()
