# PO Timeline — Desktop (Tauri v2 + React + SQLite)

Port desktop local-first dari `po-timeline-interaktif` (web: NestJS + Postgres).
Target build pertama: **Windows** (MSI/NSIS). Tanpa server, tanpa jaringan:
1 file SQLite per device.

## Struktur

- `src/` — UI React (reuse 90% dari `frontend/` web: Gantt custom, notes/issues,
  progress, guest-by-code). Hanya `src/api/*` yang ditulis ulang ke `invoke()`,
  plus `HashRouter` (aman untuk webview `tauri://`) dan stub export MVP.
- `core/` — Rust library `timeline-core`: SQLite (`rusqlite/bundled`, nol
  system-deps), auth lokal (Argon2 + JWT device-secret), validasi sama dengan
  DTO backend, audit best-effort, `seed_demo()`. Punya integration tests.
- `src-tauri/` — wrapper tipis: tiap Tauri command = 3 baris delegasi ke core.
  DB di `%APPDATA%/id.po.timeline/timeline.db`, secret di `jwt.secret` sebelahnya.
- `.github/workflows/build-windows.yml` — CI: tsc + lint + `cargo test` + `tauri build`.

## Jalankan (dev, Linux OK untuk UI + core)

```bash
npm install
npx tauri dev -- -- --seed   # admin/admin123456 + data DEMO-01 & GED-A (first run)
```

Catatan: `tauri dev/build` penuh butuh WebKit/GTK di Linux — di mesin tanpa
system-deps gunakan:

```bash
npm run dev                  # UI saja (butuh backend Tauri? tidak — invoke gagal tanpa webview)
cargo test -p timeline-core --manifest-path core/Cargo.toml
npx tsc -b && npx oxlint && npx vite build
```

## Build Windows

Di Windows (atau CI): `npx tauri build --bundles msi,nsis` → `.msi`/`.exe`
di `src-tauri/target/release/bundle/`.

Setup pertama di app: buka halaman Login → **Setup admin** (`init_admin`,
hanya saat users kosong). Atau jalankan sekali dengan `--seed`.

## Perbedaan vs web

- Auth: 1 admin lokal (Argon2, JWT 30 hari, secret per-device). Guest: kode
  project dicek lokal, pesan error diseragamkan (anti-probing) seperti backend.
- MVP: **tanpa export XLSX/PDF** (`ExportMenu` melempar pesan jelas),
  activity log tetap ditulis + bisa dibaca (tombol Activity aktif).
- Tanggal `TEXT YYYY-MM-DD`, UUID `TEXT`, FK cascade — port DDL dari
  `dump-timeline_db-*.sql` (dump aslinya schema-only, data dummy via seeder).
