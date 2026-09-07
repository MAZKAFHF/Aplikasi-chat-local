"""Temporary file storage with size/extension/path-traversal validation.

Files live only on the server disk inside the current session folders and are
removed when the server restarts.
"""

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from . import config
from .session_manager import session_manager


class StorageError(Exception):
    pass


class StorageManager:
    def __init__(self):
        self.total_used = 0

    # --- helpers ------------------------------------------------------------

    def _session_dirs(self):
        return session_manager.images_dir, session_manager.files_dir

    def _allowed(self, extension: str) -> bool:
        return extension.lower() in config.ALLOWED_EXTENSIONS

    def _reserve(self, size: int):
        if size > config.MAX_FILE_SIZE:
            raise StorageError("Ukuran file melebihi batas maksimum.")
        if self.total_used + size > config.MAX_TOTAL_TEMP_STORAGE:
            raise StorageError(
                "Penyimpanan sementara server hampir atau sudah penuh. "
                "Upload baru tidak dapat dilakukan."
            )

    def _raw_extension(self, filename: str) -> str:
        return Path(filename or "").suffix.lower()

    # --- save ---------------------------------------------------------------

    async def save_upload(self, upload: UploadFile) -> dict:
        original_name = upload.filename or "file"
        extension = self._raw_extension(original_name)

        if not self._allowed(extension):
            raise StorageError("Format file tidak didukung.")

        contents = await upload.read()
        size = len(contents)
        self._reserve(size)

        is_image = extension in config.IMAGE_EXTENSIONS
        stored_name = f"{uuid.uuid4().hex}{extension}"
        images_dir, files_dir = self._session_dirs()
        target_dir = images_dir if is_image else files_dir

        target_path = self._safe_path(target_dir, stored_name)
        try:
            with open(target_path, "wb") as handle:
                handle.write(contents)
        except OSError as exc:
            raise StorageError("Upload gagal. Silakan coba lagi.") from exc

        self.total_used += size
        folder = "images" if is_image else "files"
        mime = (
            config.IMAGE_MIME_TYPES.get(extension, "application/octet-stream")
            if is_image
            else config.FILE_MIME_TYPES.get(extension, "application/octet-stream")
        )

        return {
            "id": stored_name.split(".")[0],
            "original_name": original_name,
            "stored_name": stored_name,
            "url": f"/temp/{folder}/{stored_name}",
            "size": size,
            "mime_type": mime,
            "is_image": is_image,
        }

    # --- serving ------------------------------------------------------------

    def resolve_image(self, filename: str) -> Path:
        return self._resolve_in(session_manager.images_dir, filename)

    def resolve_file(self, filename: str) -> Path:
        return self._resolve_in(session_manager.files_dir, filename)

    def _resolve_in(self, base_dir, filename):
        # Guard against path traversal.
        try:
            path = (base_dir / (filename or "")).resolve()
            base = Path(base_dir).resolve()
            if not path.is_relative_to(base):
                raise HTTPException(status_code=404, detail="File tidak ditemukan.")
            if not path.exists() or not path.is_file():
                raise HTTPException(status_code=404, detail="File sudah tidak tersedia.")
            return path
        except ValueError:
            raise HTTPException(status_code=404, detail="File tidak ditemukan.")

    @staticmethod
    def _safe_path(base_dir, stored_name):
        base = Path(base_dir).resolve()
        candidate = (base / stored_name).resolve()
        if not candidate.is_relative_to(base):
            raise StorageError("Upload gagal. Silakan coba lagi.")
        return candidate


# Build a default extension for MIME lookup used by the file-serving routes.
def mime_for_stored_name(stored_name: str, is_image: bool) -> str:
    ext = Path(stored_name).suffix.lower()
    table = config.IMAGE_MIME_TYPES if is_image else config.FILE_MIME_TYPES
    return table.get(ext, "application/octet-stream")
