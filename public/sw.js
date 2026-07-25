/*
 * Service worker tulis tangan, tanpa vite-plugin-pwa / workbox.
 *
 * Bisa sesederhana ini karena Vite memberi nama berkas aset dengan hash isi
 * (`index-CJn7HDBN.js`). Nama yang berubah tiap kali isinya berubah membuat
 * cache-first pada aset TIDAK MUNGKIN menyajikan versi lama: build baru meminta
 * nama baru, yang belum ada di cache. Jadi daftar precache — satu-satunya
 * bagian yang benar-benar butuh alat build — tidak diperlukan.
 *
 * Yang tetap harus hati-hati cuma HTML-nya: namanya tidak berhash, jadi dia
 * network-first supaya build baru terambil begitu ada jaringan.
 *
 * Data user tidak lewat sini sama sekali — semuanya di localStorage.
 */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const FONTS = `fonts-${VERSION}`;
const CURRENT = [SHELL, ASSETS, FONTS];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/**
 * Simpan shell + seluruh aset build sekaligus, jangan tunggu diminta.
 *
 * Pada kunjungan PERTAMA, halaman sudah selesai memuat asetnya sebelum service
 * worker mengambil alih, jadi berkas-berkas itu tidak pernah lewat handler
 * `fetch` dan tidak ikut tersimpan. Tanpa precache di sini, app baru benar-benar
 * bisa dibuka offline setelah kunjungan KEDUA.
 *
 * Daftarnya dari `asset-manifest.json` (dihidupkan lewat `build.manifest` di
 * vite.config.ts), bukan dari menyisir index.html: chunk yang dimuat dinamis —
 * goey-toast — tidak pernah disebut di HTML.
 */
async function precache() {
  const shell = await caches.open(SHELL);
  const response = await fetch('/', { cache: 'reload' });
  await shell.put('/', response);

  const files = new Set();
  try {
    const manifest = await fetch('/asset-manifest.json', { cache: 'reload' }).then((r) => r.json());
    for (const entry of Object.values(manifest)) {
      if (entry.file) files.add('/' + entry.file);
      for (const css of entry.css ?? []) files.add('/' + css);
      for (const asset of entry.assets ?? []) files.add('/' + asset);
    }
  } catch {
    // Manifest tidak ada (mis. dijalankan dari dev server). Bukan alasan untuk
    // menggagalkan install — aset tetap tersimpan sambil jalan lewat `fetch`.
    return;
  }

  const assets = await caches.open(ASSETS);
  await Promise.all(
    [...files].map((url) =>
      assets.add(url).catch(() => {
        // Satu berkas gagal tidak boleh membatalkan seluruh precache.
      }),
    ),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CURRENT.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Dikirim dari lib/pwa.ts saat user menekan "Muat Ulang" di toast versi baru.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Respons opaque (font lintas-origin) statusnya 0 tapi tetap layak disimpan.
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

/** HTML: jaringan dulu, cache jadi jaring pengaman saat offline. */
async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch {
    const hit = await cache.match('/');
    if (hit) return hit;
    throw new Error('offline dan shell belum tersimpan');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, FONTS));
    return;
  }

  // Ikon & manifest: sedikit, jarang berubah, ikut cache aset.
  if (url.origin === self.location.origin && /\.(png|webmanifest|svg)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS));
  }
});
