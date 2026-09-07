"""Entry point to run the LocalRoom Chat server."""

import uvicorn

from app import config

if __name__ == "__main__":
    print("=" * 50)
    print("  LocalRoom Chat")
    print("  Server siap di http://0.0.0.0:8000")
    print("  Client membuka: http://IP_SERVER:8000")
    print("  Tekan Ctrl+C untuk menghentikan server.")
    print("=" * 50)
    uvicorn.run(
        "app.main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
    )
