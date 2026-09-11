# Login tersembunyi + sinkron cloud (Neon)

Tanggal: 11 September 2026
Status: desain disetujui, spike lolos, menunggu review spec

## Tujuan

Data finlog bisa dipakai di lebih dari satu device. Login dibuka lewat klik logo
"finlog" di header (tidak ada tombol login yang terlihat). Sudah login, klik logo
lagi memunculkan toast konfirmasi logout.

## Keputusan

| Hal | Keputusan |
|---|---|
| Backend | Neon: Neon Auth (Managed Better Auth) + Neon Data API (PostgREST), langsung dari browser, tanpa server sendiri |
| Klien auth | `better-auth/client@1.6.23` (versi yang dipin `@neondatabase/auth`), dimuat dinamis. Bukan `@neondatabase/neon-js` (~110 kB gzip) |
| Klien data | `fetch` polos ke Data API, tanpa library |
| Model sync | localStorage tetap sumber utama. Tiap perubahan di-push (debounce 3 detik). Pull hanya saat login. Satu blob per user, last-write-wins |
| Konflik saat login | Dua sisi berisi dan berbeda: user memilih. Salah satu kosong: pakai yang berisi tanpa bertanya |
| Akun | Login saja, tidak ada form daftar di app |

## Hasil spike (11 Sep 2026, Firefox 155, `localhost:5173`)

Lolos: sign up, sign in, get session, JWT (dari header `set-auth-jwt` maupun body
`/token`), push pertama (201), push kedua dan ketiga ke baris yang sama (201,
pull mengembalikan isi push terakhir), pull (200, hanya baris milik sendiri),
sign out.

Temuan:

- CORS Auth mengizinkan origin `http://localhost:5173` dengan `allow-credentials: true`.
- Session: cookie HttpOnly di domain Neon, berlaku 7 hari. JWT berlaku 15 menit.
- `emailVerified: false` tidak menghalangi login.
- Endpoint sign-up terbuka untuk publik.
- Ukuran `better-auth/client` terpakai: 10,4 kB gzip.
- Upsert ke baris yang sudah ada tidak mengubah `updated_at` (`DEFAULT now()`
  hanya berlaku saat insert). Karena itu `push()` wajib mengirim `updated_at`.

Belum terbukti: isolasi RLS antar-user, Safari/iOS.

## Setup Neon (sekali)

Auth + Data API aktif, JWT provider = Managed Better Auth,
`http://localhost:5173` dan domain produksi ada di trusted origins.

```sql
CREATE TABLE public.finlog_snapshot (
    user_id text PRIMARY KEY DEFAULT auth.user_id(),
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finlog_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finlog-select-own" ON public.finlog_snapshot
    FOR SELECT TO authenticated
    USING (auth.user_id() = user_id);

CREATE POLICY "finlog-insert-own" ON public.finlog_snapshot
    FOR INSERT TO authenticated
    WITH CHECK (auth.user_id() = user_id);

CREATE POLICY "finlog-update-own" ON public.finlog_snapshot
    FOR UPDATE TO authenticated
    USING (auth.user_id() = user_id)
    WITH CHECK (auth.user_id() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.finlog_snapshot TO authenticated;
```

Setelah akun pemilik dibuat, matikan sign-up publik di pengaturan Neon Auth kalau
opsinya tersedia. Kalau tidak ada, RLS tetap mengisolasi data, tapi orang lain
bisa membuat akun kosong.

Env (build time, bukan rahasia; ikut ter-bundle): `VITE_NEON_AUTH_URL`,
`VITE_NEON_DATA_API_URL`. Lokal di `.env.local`; `*.local` ditambahkan ke
`.gitignore`. Build produksi wajib menyetel keduanya.

## Skema localStorage

Key `finance_*` dan `keuangan_*` tidak berubah. Satu key baru:

- `finlog_cloud` → `{ "email": string, "dirty": boolean }`, atau tidak ada = belum login.

Awalannya bukan `finance_`, jadi otomatis tidak ikut `exportAll`, `importAll`,
`deleteAllData`, dan tidak ikut di-sync. Aksesnya tetap lewat `storage.ts`.

Isi blob cloud = `exportAll()` apa adanya (semua key `finance_*`). Flag perangkat
(`keuangan_bal_hidden`, `keuangan_tutorial_done`) tidak di-sync.

## Komponen

### `src/lib/storage.ts`

- `onFinanceChange(cb | null)`: satu listener. Dipanggil dari `writeJSON` (hanya
  kalau key-nya `finance_*`), `removeMonth`, dan `deleteAllData`. Karena
  `saveMonth`, `saveAccounts`, `saveWishlist`, `importAll`, dan `updateMonthAt`
  semuanya lewat `writeJSON`, semua jalur tulis tertangkap di satu tempat.
- `loadCloudState()`, `saveCloudState(s | null)` untuk key `finlog_cloud`, tanpa
  memicu listener.

### `src/lib/cloud.ts`

- `cloudEnabled`: kedua env terisi. Kalau `false`, klik logo tidak melakukan apa-apa.
- Klien auth dimuat dinamis (`import('better-auth/client')`) dan di-memo. Tidak
  pernah dimuat untuk pengunjung yang belum login dan tidak mengklik logo.
- `signIn(email, password)`, `signOut()`.
- `getJwt()`: `$fetch('/token')` → `data.token`, di-cache sampai 60 detik sebelum `exp`.
- `pull()`: `GET /finlog_snapshot?select=data,updated_at` → snapshot atau `null`.
- `push()`: `POST /finlog_snapshot`, header
  `Prefer: resolution=merge-duplicates,return=minimal`, body
  `{ data: exportAll(), updated_at: <sekarang> }`. Isi diambil saat request
  dikirim, bukan saat perubahan terjadi.
- Penjadwal sync: `startSync(onExpired)` / `stopSync()`. Perubahan → `dirty = true`
  → debounce 3 detik → `push()` → `dirty = false`. Event `online` dan startup
  dengan `dirty = true` memicu push.
- Fungsi murni: `sameSnapshot(a, b)` (perbandingan dalam, urutan key object
  diabaikan karena `jsonb` Postgres mengurutkan ulang key; urutan array tetap
  berarti) dan `decideOnLogin(local, cloud)` → `'push' | 'pull' | 'ask' | 'same'`.

| Lokal | Cloud | Hasil |
|---|---|---|
| kosong | kosong / tidak ada | `same` |
| berisi | kosong / tidak ada | `push` |
| kosong | berisi | `pull` |
| berisi | berisi, sama | `same` |
| berisi | berisi, beda | `ask` |

"Kosong" = tidak ada satu pun key `finance_*`.

### `src/components/LoginModal.tsx`

Dibangun di atas `Modal` yang sudah ada. Dua tahap:

1. Form email + password. Gagal → pesan di dalam modal ("Email atau password
   salah" / "Tidak bisa terhubung ke server").
2. Kalau `decideOnLogin` = `ask`: pilihan "Pakai data cloud" (data di device
   ini ditimpa; ditampilkan `updated_at` cloud) dan "Pakai data device ini"
   (data cloud ditimpa). Menutup modal tanpa memilih = `signOut()`, tidak ada
   yang ditimpa.

### `src/components/Header.tsx`

`<h1>finlog</h1>` jadi `<h1><button className="brand-btn">finlog</button></h1>`,
tampilan identik (reset style tombol di `system.css`). Prop baru `onBrandClick`.

### `src/lib/toast.ts`

Tambah `toast.info` (goey-toast menyediakan jenis `info`).

### `src/App.tsx` (`Shell`)

- State `cloudEmail` dari `loadCloudState()`.
- Mount: kalau `finlog_cloud` ada → `startSync(onExpired)`.
- Klik logo: `cloudEnabled` false → abaikan. Belum login → buka `LoginModal`.
  Sudah login → `toast.info('Keluar dari akun <email>?', { action: { label: 'Logout', ... }, duration: 8000, displayDuration: 8000 })`.
  `displayDuration` wajib: tanpa itu goey-toast menciutkan toast jadi pil dan membuang tombol
  aksinya sebelum `duration` habis (terbukti di uji browser: tombol hilang di detik ke-3 sampai ke-6).

## Alur

**Login**

1. `signIn` berhasil → `pull()`.
2. Hitung `decideOnLogin(exportAll(), cloud)`:
   - `push` → `push()` sekarang.
   - `pull` → `deleteAllData()` + `importAll(cloud)` + `reloadAll()`.
   - `same` → tidak ada apa-apa.
   - `ask` → tahap 2 modal, lalu jalankan `push` atau `pull` sesuai pilihan.
3. `saveCloudState({ email, dirty: false })`, `startSync`, toast
   "Masuk sebagai <email>".

Invarian: `startSync` baru jalan setelah keputusan di langkah 2 selesai. Kalau
lebih awal, perubahan lokal bisa ter-push menimpa cloud sebelum user memilih.

Pull gagal setelah sign-in berhasil → `signOut()`, pesan error, tidak ada yang
ditimpa.

**Logout** (tombol di toast): `stopSync` → kalau `dirty`, coba `push()` sekali →
`signOut()` → `saveCloudState(null)` → toast "Berhasil keluar". Data lokal
tidak dihapus.

**Session habis** (401 dari `/token` atau Data API): `stopSync`,
`saveCloudState(null)`, toast error "Sesi cloud habis. Klik logo finlog untuk
login lagi." Login berikutnya melewati `decideOnLogin`, jadi perubahan lokal
yang belum ter-push memicu pilihan `ask`, tidak hilang diam-diam.

**Push gagal karena jaringan**: `dirty` tetap `true`, dicoba lagi pada perubahan
berikutnya, event `online`, atau startup. Tidak ada toast per kegagalan.

## Batas yang diketahui

- Last-write-wins seluruh blob. Device A yang offline lalu push belakangan akan
  menimpa perubahan device B. Jalur upgrade: simpan `updated_at` terakhir di
  `finlog_cloud`, push sebagai `PATCH ...?updated_at=eq.<base>`; 0 baris
  berubah = konflik → tampilkan pilihan `ask`.
- Push mengirim seluruh blob tiap kali. Wajar untuk data bertahun-tahun (ratusan
  kB); kalau membengkak, pecah per key.
- Safari/iOS memblokir cookie pihak ketiga; session cookie Neon ada di domain
  Neon. Belum diuji. Kalau gagal, perlu custom domain Auth di domain yang sama
  dengan app.

## Service worker & bundle

`sw.js` tidak berubah: request ke domain Neon bukan navigasi, bukan `/assets/`,
bukan font, jadi tidak di-intercept. Chunk `better-auth/client` ikut
`asset-manifest.json` dan ter-precache. Bundle awal tidak bertambah; cek dengan
`npm run build`.

## Pengujian

Otomatis:

- `src/lib/logic.test.ts`: lima baris tabel `decideOnLogin`; `sameSnapshot`
  menganggap sama dua object dengan urutan key berbeda, dan berbeda untuk array
  dengan urutan berbeda.
- `src/App.smoke.test.tsx`: listener terpanggil pada `saveMonth`, `importAll`,
  `deleteAllData`, dan tidak terpanggil pada `setFlag` / `saveCloudState`;
  klik logo tanpa env tidak membuka apa pun; dengan env membuka `LoginModal`;
  dengan `finlog_cloud` terisi memanggil `toast.info` beraksi "Logout"
  (`lib/toast` di-mock).

Manual ke Neon asli (dev server, akun uji):

1. Login di device dengan localStorage kosong → data cloud muncul.
2. Login dengan dua sisi berbeda → pilihan muncul; uji kedua tombol dan tutup modal.
3. Ubah data → tunggu 3 detik → pull via spike menunjukkan perubahan (push kedua dan seterusnya).
4. Reload halaman → masih login, sync tetap jalan.
5. Offline → ubah data → online → ter-push.
6. Klik logo → toast → Logout → data lokal tetap ada.
7. Akun kedua tidak bisa membaca baris akun pertama.
8. Safari/iOS di build HTTPS.
