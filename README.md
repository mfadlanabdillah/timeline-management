# PO Timeline — Desktop (Tauri v2 + React + SQLite)

Port desktop local-first dari `po-timeline-interaktif` (web: NestJS + Postgres).
Target build pertama: **Windows** (MSI/NSIS). Tanpa server, tanpa jaringan:
1 file SQLite per device.

## Struktur

- `src/` — UI React (reuse 90% dari `frontend/` web: Gantt custom, notes/issues,
  progress, guest-by-code). Hanya `src/api/*` yang ditulis ulang ke `invoke()`,
  plus `HashRouter` (aman untuk webview `tauri://`) dan export XLSX/PDF via dialog Save native.
- `core/` — Rust library `timeline-core`: SQLite (`rusqlite/bundled`, nol
  system-deps), auth lokal (Argon2 + JWT device-secret), validasi sama dengan
  DTO backend, audit best-effort, `seed_demo()`. Punya integration tests.
- `src-tauri/` — wrapper tipis: tiap Tauri command = 3 baris delegasi ke core.
  DB di `%APPDATA%/id.po.timeline/timeline.db`, secret di `jwt.secret` sebelahnya.
- `native/` — app pure native (Slint), lihat bagian di bawah.
- `.github/workflows/build-windows.yml` — CI: tsc + lint + `cargo test` + `tauri build`, plus build exe native.

## App native (Slint) — `native/` (sedang dikembangkan)

Versi **pure native** tanpa WebView, dengan desain ulang **Fluent / Windows 11**
(NavigationView, warna ala Mica, Segoe UI Variable + Segoe Fluent Icons, terang/gelap/ikuti
sistem). UI-nya ditulis dengan [Slint](https://slint.dev) dan memanggil `core/`
secara langsung (tanpa `invoke`/JSON). Datanya memakai DB yang sama dengan versi
Tauri (`%APPDATA%\id.po.timeline`), jadi kedua versi bisa dipakai bergantian.

- `native/ui/*.slint` — `theme` (design token), `controls` (Button, NavItem,
  InfoBar, ContentDialog, …), `login`, `home` (portfolio), `project` (Gantt),
  `dialogs`, `app` (window + sidebar).
- `native/src/gantt.rs` — layout Gantt (posisi px, header hari/bulan, garis hari
  ini), di-unit-test. `core/src/health.rs` — status On track/At risk/… (port dari
  `healthUtils.ts`), dipakai bersama.
- Renderer software Slint: RAM ±30 MB (vs ±140 MB dengan OpenGL), exe tunggal
  ±18 MB, tidak butuh WebView2.

Fase 1 (selesai): login/setup admin, sesi tersimpan, portfolio + KPI, CRUD
project, Gantt (zoom hari/minggu, drag untuk geser, tarik tepi untuk resize,
urut naik/turun), CRUD item + kalender, export XLSX/PDF, tema.
Fase 2: notes/issues + balasan, progress & kurva S, dependensi + critical path,
guest-by-code, activity log.

```bash
cargo run --manifest-path native/Cargo.toml -- --seed   # admin/admin123456 + data demo
cargo build --release --manifest-path native/Cargo.toml # native/target/release/po-timeline.exe
```

Mode portable: taruh file kosong bernama `portable` di sebelah exe, maka data
disimpan di folder `data\` di sebelahnya (misalnya untuk flashdisk). Lokasi data
juga bisa diganti dengan env `PO_TIMELINE_DATA_DIR`.

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
- Export XLSX/PDF dibuat di Rust (`core/src/export.rs`: `rust_xlsxwriter` +
  `printpdf`), aturan akses sama dengan baca (admin token atau kode project).
  XLSX: sheet Timeline, Notes & Issues, Progress, Dependencies. PDF: tabel +
  mini-Gantt (progress, milestone, garis hari ini) + daftar issue terbuka.
- Activity log tetap ditulis + bisa dibaca (tombol Activity aktif).
- Semua Tauri command memakai `rename_all = "snake_case"` — argumen dari TS
  dikirim snake_case (`item_id`, `project_id`, ...).
- Tanggal `TEXT YYYY-MM-DD`, UUID `TEXT`, FK cascade — port DDL dari
  `dump-timeline_db-*.sql` (dump aslinya schema-only, data dummy via seeder).
