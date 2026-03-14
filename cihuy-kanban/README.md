# cihuy-kanban

Aplikasi project management self-hosted untuk domain `cihuy-familly` dengan UI kanban fleksibel, Gantt View, S-Chart, auth sederhana, dan dark mode.

## Fitur Utama

- Frontend dan backend dipisah.
- Setup awal wajib buat akun admin.
- Auth JWT dengan masa aktif token 7 hari.
- Admin dapat membuat user normal/admin.
- Dashboard dan `project_[nama]` dipisah tab.
- Board/list kanban dinamis (user bebas buat list sesuai workflow).
- Task per card/list dengan field lengkap:
  - Judul, deskripsi, assignee (work by who), start, end, deadline, note.
- Menu aksi untuk list dan task (`...`):
  - Edit, Archive, Delete Permanen.
- Archived list/task bisa dilihat dan di-restore.
- Gantt View.
- S-Chart (Planned vs Actual).
- Theme Cihuy + Dark Mode toggle.
- Database ringan SQLite (tanpa service DB tambahan).

## Struktur Project

- `backend/` API Node.js + Express + SQLite
- `frontend/` React + Vite + Chart.js
- `docker-compose.yml`
- `docker.env.example`
- `docs/APP_DOCUMENTATION.md`

## Jalankan Dengan Docker (Recommended)

1. Masuk folder project:

```bash
cd cihuy-kanban
```

2. Siapkan env Docker:

```bash
cp docker.env.example .env
```

3. Edit `.env` minimal pada `JWT_SECRET`.

4. Jalankan container:

```bash
docker compose up -d --build
```

5. Akses:

- Frontend: `http://localhost:3011`
- Backend health: `http://localhost:3012/api/health`

## Konfigurasi Docker Penting

Di file `.env` (root project):

- `BACKEND_PORT` default `3012`
- `FRONTEND_PORT` default `3011`
- `JWT_SECRET` wajib diganti
- `TOKEN_EXPIRES_IN` default `7d`
- `FRONTEND_URL` untuk CORS backend
- `VITE_API_URL` endpoint backend untuk frontend build

Contoh jika pakai domain:

- `FRONTEND_URL=https://cihuy-familly`
- `VITE_API_URL=https://cihuy-familly/api`

## First Run Flow

Saat pertama kali run:

1. Buka UI.
2. Muncul form setup admin.
3. Buat akun admin pertama.
4. Login.
5. Admin bisa bikin user lain.

## Jalankan Lokal Tanpa Docker

### Backend

```bash
cd backend
cp .env.example .env
corepack pnpm install
corepack pnpm run init-db
corepack pnpm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
corepack pnpm install
corepack pnpm run dev
```

## Dokumentasi Lengkap

Lihat dokumentasi aplikasi lengkap di:

- [docs/APP_DOCUMENTATION.md](./docs/APP_DOCUMENTATION.md)
