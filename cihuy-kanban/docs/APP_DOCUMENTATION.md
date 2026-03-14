# APP Documentation - cihuy-kanban

Dokumentasi ini menjelaskan arsitektur, flow, fitur, dan operasional aplikasi `cihuy-kanban`.

## 1. Ringkasan

`cihuy-kanban` adalah aplikasi project management self-hosted dengan fokus:

- Kanban fleksibel (board/list dinamis)
- Timeline visual (Gantt)
- Progress kumulatif (S-Chart)
- Multi-user dengan role (`admin`, `user`)
- Auth JWT sederhana
- Archive/restore list dan task
- Theme Cihuy + Dark Mode

## 2. Arsitektur

### Frontend

- React + Vite
- Chart.js (`react-chartjs-2`) untuk S-Chart
- Menyimpan token login di `localStorage`
- Menyimpan preferensi theme (`light/dark`) di `localStorage`

### Backend

- Node.js + Express
- Auth JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- SQLite (`better-sqlite3`)

### Database

Database default: SQLite file

- Path container: `/app/data/cihuy-kanban.db`
- Persist via docker volume: `cihuy-kanban-data`

## 3. Auth & Role

### First Setup

- Jika belum ada admin, endpoint setup akan aktif.
- User pertama yang dibuat via setup menjadi `admin`.

### Login

- Login menghasilkan JWT.
- Token expiry default: `7d` (`TOKEN_EXPIRES_IN`).

### Role

- `admin`: bisa membuat user baru.
- `user`: akses normal project/task.

## 4. Navigasi UI

### 4.1 Top Shell

- Brand: `cihuy-kanban`
- Info user login
- Tombol `Light Mode / Dark Mode`
- Tombol `Logout`
- Tab utama:
  - `dashboard`
  - `project_[nama_project]`

### 4.2 Dashboard

- Form buat project
- Form buat user (admin only)
- Kartu daftar project (jumlah task/list aktif/arsip)

### 4.3 Project Shell

- Header project + deskripsi
- Sub-tab:
  - `Card/List Kanban`
  - `Gantt View`
  - `S-Chart (Planned vs Actual)`

## 5. Kanban Behavior

### 5.1 List/Card Kanban

- User bebas membuat list workflow (tidak hardcoded To Do/In Progress/Done).
- Tiap list punya menu `...`:
  - Edit
  - Archive
  - Delete Permanen

### 5.2 Task

Task field:

- title
- description
- assignee
- start_date
- end_date
- deadline_date
- note
- status (todo/done)

Aksi task via menu `...`:

- Edit (hero card modal)
- Archive
- Delete Permanen

Jika task ditandai done (`Mark as Done`), card task berubah warna hijau.

### 5.3 Archive

- Archived list dan archived task ditampilkan di panel arsip.
- Keduanya bisa `Restore`.
- `Delete Permanen` tidak dapat di-restore.

## 6. Gantt View

- Menampilkan task yang punya start + end/deadline valid.
- Bar status:
  - todo = biru
  - done = hijau

## 7. S-Chart

- Planned: akumulasi berdasarkan `end_date`.
- Actual: akumulasi berdasarkan `done_at`.
- Task archived tidak dihitung.

## 8. Theme System

Aplikasi punya 2 mode:

- Light (Cihuy gradient ungu-biru)
- Dark (palet biru gelap)

Teknis:

- CSS variables di `:root` dan `[data-theme='dark']`
- Theme disimpan di localStorage key `cihuy_theme`

## 9. API Ringkas

Base URL backend: `/api`

Endpoint penting:

- `GET /api/setup/status`
- `POST /api/setup/admin`
- `POST /api/auth/login`
- `GET /api/me`
- `GET/POST /api/users`
- `GET/POST /api/projects`
- `GET/POST /api/projects/:projectId/columns`
- `PUT/DELETE /api/columns/:columnId`
- `PATCH /api/columns/:columnId/archive`
- `PATCH /api/columns/:columnId/restore`
- `GET/POST /api/projects/:projectId/tasks`
- `PUT/DELETE /api/tasks/:taskId`
- `PATCH /api/tasks/:taskId/archive`
- `PATCH /api/tasks/:taskId/restore`
- `GET /api/projects/:projectId/analytics/s-curve`

## 10. Konfigurasi Environment

### Backend

- `PORT` (default `3012`)
- `JWT_SECRET` (wajib)
- `TOKEN_EXPIRES_IN` (default `7d`)
- `FRONTEND_URL` (untuk CORS)
- `DB_PATH` (path sqlite)

### Frontend

- `VITE_API_URL` (contoh: `http://localhost:3012/api`)

## 11. Operasional Docker

### 11.1 Build & Run

```bash
docker compose up -d --build
```

### 11.2 Logs

```bash
docker compose logs -f cihuy-kanban-backend
docker compose logs -f cihuy-kanban-frontend
```

### 11.3 Stop

```bash
docker compose down
```

### 11.4 Stop + hapus volume DB

```bash
docker compose down -v
```

## 12. Troubleshooting

### Frontend tidak konek backend

- Pastikan `VITE_API_URL` benar.
- Pastikan `FRONTEND_URL` backend berisi origin yang dipakai browser.
- Untuk local, biasanya isi:
  - `http://localhost:3011,http://127.0.0.1:3011`

### Port bentrok

- Ubah `BACKEND_PORT` / `FRONTEND_PORT` di `.env` root.
- Jalankan ulang compose.

### Token expired

- User harus login ulang (behavior normal).

## 13. Catatan Security

- Wajib ganti `JWT_SECRET` sebelum deploy publik.
- Taruh reverse proxy + TLS (HTTPS) untuk domain production.
- Batasi akses jaringan backend jika tidak perlu publik.
