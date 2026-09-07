# LocalRoom Chat

Aplikasi web komunikasi lokal untuk kelompok kecil (±4 orang) pada jaringan Wi-Fi/LAN yang sama. Berjalan **tanpa internet, cloud, database, dan tanpa layanan pihak ketiga**. Satu laptop menjadi server, laptop lain mengakses melalui browser.

**SIMPLE FIRST · LOCAL FIRST · TEMPORARY FIRST · PYTHON FIRST**

## Features

- Chat grup real-time (WebSocket `/ws`)
- Berbagi link — otomatis jadi hyperlink yang dibuka di tab baru
- Upload & lihat gambar (JPG/PNG/GIF/WEBP) dengan lightbox
- Upload & download file (PDF/DOC/XLS/PPT/TXT/ZIP, dll) dengan validasi ekstensi & MIME
- Daftar pengguna online real-time
- Notifikasi: unread badge, judul tab `(3) LocalRoom Chat`, Browser Notification API
- Status koneksi (`Connected` / `Connecting` / `Disconnected`) + auto-reconnect (max delay 5 detik)
- Penyimpanan sementara: RAM untuk pesan (deque max 1000), disk temporary untuk file (max 100 MB/file, 2 GB total)
- Sesi per-server-start dengan pembersihan otomatis (`temp_data/sessions/<session_id>/`)

Data hanya disimpan di laptop server dan **bersih otomatis saat server direstart**.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Language** | Python 3.10+ (menggunakan `X | Y` union syntax & `Path.is_relative_to`) |
| **Framework** | FastAPI |
| **Server** | Uvicorn (`uvicorn[standard]`) |
| **Template** | Jinja2 |
| **Upload** | python-multipart |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (WebSocket API, Fetch API) |
| **Storage** | In-memory `collections.deque` + filesystem sementara (`temp_data/sessions/`) |
| **Package Manager** | pip (`requirements.txt`) |

Tidak ada database eksternal (Prisma/Drizzle/PostgreSQL/MongoDB tidak digunakan). Tidak ada Firebase/Supabase.

## Project Structure

```text
.
├── app/
│   ├── main.py                 # FastAPI app + lifespan + WebSocket /ws
│   ├── config.py               # semua pengaturan terpusat
│   ├── session_manager.py      # siklus hidup sesi + pembersihan temp_data
│   ├── storage_manager.py      # validasi & penyimpanan file temporary
│   ├── websocket_manager.py    # koneksi, broadcast, riwayat in-memory
│   └── routers/
│       ├── api.py              # GET /api/messages | /users | /status
│       └── upload.py           # POST /api/upload, GET /temp/images|files
├── templates/
│   ├── login.html
│   └── chat.html
├── static/
│   ├── css/style.css
│   └── js/
│       ├── app.js              # helper: escapeHtml, linkify, formatSize
│       ├── websocket.js        # ChatSocket: auto-reconnect
│       ├── chat.js             # logika chat utama
│       ├── login.js            # validasi login
│       └── notifications.js    # Browser Notification wrapper
├── temp_data/sessions/         # dibuat otomatis per server start (ignored)
├── run.py                      # entry point
└── requirements.txt
```

## Requirements

- Python 3.10+ (disarankan 3.11 atau 3.13)
- pip
- Browser modern dengan dukungan WebSocket
- Semua perangkat di jaringan Wi-Fi/LAN yang sama

## Installation

### Windows

```cmd
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python run.py
```

Alternatif tanpa `run.py`:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Server berjalan di `0.0.0.0:8000`.

## Akses dari Laptop Lain

Di laptop server, cari IP lokal:

```cmd
ipconfig
```

Gunakan nilai **IPv4 Address** (mis. `192.168.1.10`).

Laptop lain membuka di browser:

```text
http://192.168.1.10:8000
```

## Konfigurasi

Semua nilai dapat diubah di `app/config.py`:

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `HOST` / `PORT` | `0.0.0.0` / `8000` | Bind address |
| `MAX_MESSAGES` | `1000` | Kapasitas deque pesan in-memory |
| `MAX_FILE_SIZE` | `100 MB` | Batas per file upload |
| `MAX_TOTAL_TEMP_STORAGE` | `2 GB` | Total penyimpanan temporary per sesi |
| `MAX_USERNAME_LENGTH` | `30` | Panjang username max |
| `MIN_USERNAME_LENGTH` | `1` | Panjang username min |
| `RECONNECT_MAX_DELAY` | `5` detik | Delay reconnect WebSocket |
| `TEMP_DATA_DIR` | `BASE_DIR / "temp_data"` | Root storage temporary |
| `IMAGE_EXTENSIONS` | `.jpg .jpeg .png .gif .webp` | Ekstensi gambar diizinkan |
| `FILE_EXTENSIONS` | `.pdf .doc .docx .ppt .pptx .xls .xlsx .txt .zip` | Ekstensi file diizinkan |

Tidak ada `.env` yang diperlukan. Jika ingin menambahkan environment variable sendiri, buat `.env.example` sebagai template dan jangan commit `.env` asli.

## Environment Variables

Proyek ini **tidak memerlukan** environment variable untuk berjalan. Konfigurasi hardcoded di `app/config.py`.

Jika Anda menambahkan secret di masa depan (mis. API key), ikuti pola:

```bash
# .env.example (commit yang ini)
SECRET_KEY=your_secret_here

# .env (jangan commit, sudah di .gitignore)
SECRET_KEY=...
```

## Database

Tidak menggunakan database permanen.

- **Pesan chat**: `collections.deque(maxlen=1000)` in-memory di `websocket_manager.py`
- **File upload**: disimpan di `temp_data/sessions/<session_id>/images/` dan `.../files/`, di-resolve dengan `Path.resolve()` + `is_relative_to()` untuk mencegah path traversal.
- **Lifecycle**: setiap `lifespan` start, `SessionManager.start_new_session()` menghapus semua sesi lama dan membuat sesi baru `uuid4().hex`.

Boleh di-commit: schema/migrasi (tidak ada pada proyek ini). Jangan commit: `*.db`, `*.sqlite`, dump produksi, atau data user asli — semua sudah di-ignore.

## Authentication

Sederhana tanpa password:

- User memasukkan username di `/` (validasi: trim, 1–30 karakter, tidak kosong/hanya spasi)
- Username disimpan di `sessionStorage` (`localroom_user`)
- Server menolak duplicate username via `ConnectionManager.add_user()` — jika duplikat, kirim `error` dan `websocket.close()`
- Username hanya berlaku selama server aktif. Disconnect otomatis menghapus user dari `connections`.

## API Reference

### HTTP

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/` | Halaman login |
| `GET` | `/chat` | Halaman chat |
| `GET` | `/api/messages?limit=100` | Ambil riwayat pesan (query `0–1000`) |
| `GET` | `/api/users` | Daftar user online |
| `GET` | `/api/status` | `{ session_id, online_users, status }` |
| `POST` | `/api/upload` | Upload file (`multipart/form-data`, field `file`) |
| `GET` | `/temp/images/{filename}` | Serve gambar temporary |
| `GET` | `/temp/files/{filename}` | Serve file temporary |
| `GET` | `/static/...` | Static files |

### WebSocket

Endpoint: `ws://<host>:8000/ws` (atau `wss://` jika di belakang TLS proxy)

**Client → Server:**

```json
{ "type": "user_join", "username": "budi" }
{ "type": "chat_message", "content": "halo" }
{ "type": "file_message", "file": { "stored_name": "...", "is_image": true, ... } }
{ "type": "ping" }
```

**Server → Client:**

```json
{ "type": "welcome", "username": "budi", "messages": [...], "users": [...], "session_id": "..." }
{ "type": "message_created", "message": { "id": "...", "type": "text|image|file", "sender": "...", "timestamp": "..." } }
{ "type": "users_updated", "users": [{ "username": "...", "status": "online" }] }
{ "type": "error", "message": "..." }
{ "type": "ping" }
{ "type": "pong" }
```

## Scripts

| Command | Deskripsi |
|---------|-----------|
| `python run.py` | Jalankan server (host/port dari `config.py`) |
| `uvicorn app.main:app --host 0.0.0.0 --port 8000` | Jalankan FastAPI langsung |
| `uvicorn app.main:app --reload` | Mode development dengan auto-reload |
| `pip install -r requirements.txt` | Install dependencies |

## Troubleshooting

- Pastikan semua laptop di Wi-Fi/LAN yang sama.
- Pastikan Windows Firewall mengizinkan Python/Uvicorn pada **private network** (atau izinkan port 8000).
- Pastikan Wi-Fi tidak mengaktifkan AP/client isolation.
- Jika IP server berubah, gunakan IP terbaru (`ipconfig` / `ifconfig`).
- Jika WebSocket disconnect terus: cek firewall, coba `ws://` vs `wss://`, lihat console browser (F12).

> Catatan: aplikasi memakai HTTP polos (tidak terenkripsi). Hanya gunakan pada jaringan lokal yang Anda percaya, bukan Wi-Fi publik.

## Security

- Tidak ada secret/token/API key di codebase — aman untuk public/private repo.
- Path traversal dilindungi: `StorageManager._safe_path()` dan `_resolve_in()` memakai `Path.resolve().is_relative_to(base)`.
- Validasi ekstensi & MIME type via `ALLOWED_EXTENSIONS` (hanya 13 ekstensi diizinkan).
- Batas ukuran file dan total storage untuk mencegah DoS disk.
- `temp_data/` dan `__pycache__/` sudah di-ignore dan tidak akan ter-commit.
- Selalu jalankan di jaringan tepercaya karena tanpa TLS. Untuk produksi publik, tambahkan reverse proxy (Nginx/Caddy) dengan TLS.

Jika Anda menambahkan credential baru, jangan commit file `.env` asli — commit hanya `.env.example` dengan placeholder `your_api_key_here`.

## Deployment

Proyek dirancang untuk **local network**, bukan cloud deploy. Tidak ada `Dockerfile`, `docker-compose.yml`, atau config Vercel/Netlify.

Untuk deploy LAN permanen, jalankan di laptop yang selalu on dan expos via IP lokal atau setup reverse proxy jika perlu.

## License

Belum ada file `LICENSE` — default hak cipta pada pemilik repository. Tambahkan lisensi (mis. MIT) jika ingin menjadikannya open-source.

---

Dibuat untuk kebutuhan komunikasi lokal cepat tanpa ketergantungan internet.
