import { toast } from './toast';

/**
 * Daftarkan service worker (`public/sw.js`) supaya app bisa dipasang dan dibuka
 * offline.
 *
 * Hanya di build produksi. Di dev, service worker yang menyimpan aset justru
 * menyembunyikan perubahan kode di balik cache lama.
 *
 * Pembaruan tidak pernah dipasang diam-diam: worker baru menunggu sampai user
 * menekan "Muat Ulang". Memaksa `skipWaiting` saat ada form terisi berarti
 * membuang ketikan user tanpa diminta.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Sudah ada yang menunggu sejak halaman dibuka (tab lain memasangnya).
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptUpdate(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const next = registration.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          // Ada controller = ini pembaruan, bukan pemasangan pertama kali.
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate(next);
          }
        });
      });
    });
  });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Penjaga loop: `controllerchange` bisa terpicu lebih dari sekali.
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function promptUpdate(worker: ServiceWorker): void {
  toast.success('Versi baru tersedia', {
    duration: Infinity,
    action: {
      label: 'Muat Ulang',
      onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }),
    },
  });
}
