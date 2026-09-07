"""HTTP routes: file upload and temporary file serving."""

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..storage_manager import StorageError, StorageManager, mime_for_stored_name

router = APIRouter(tags=["upload"])

storage = StorageManager()


@router.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        meta = await storage.save_upload(file)
    except StorageError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True, "file": meta}


@router.get("/temp/images/{filename}")
def get_image(filename: str):
    path = storage.resolve_image(filename)
    return FileResponse(path, media_type=mime_for_stored_name(filename, is_image=True))


@router.get("/temp/files/{filename}")
def get_file(filename: str):
    path = storage.resolve_file(filename)
    return FileResponse(
        path,
        media_type=mime_for_stored_name(filename, is_image=False),
        filename=None,
    )
