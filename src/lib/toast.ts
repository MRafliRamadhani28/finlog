import type { GooeyToastOptions } from 'goey-toast';

/**
 * Pembungkus goey-toast dengan import dinamis.
 *
 * goey-toast menyeret framer-motion + sonner (~205 kB mentah, 44% bundle). Toast
 * baru dibutuhkan setelah user melakukan aksi, jadi tidak perlu ikut di jalur
 * muat pertama. `import type` di atas dihapus saat kompilasi — tidak ada import
 * runtime dari file ini sampai salah satu fungsi dipanggil.
 */
const load = (): Promise<typeof import('goey-toast')> => import('goey-toast');

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  duration?: number;
  displayDuration?: number;
}

function show(kind: 'success' | 'error' | 'info', message: string, options?: ToastOptions): void {
  const { displayDuration, ...rest } = options ?? {};
  const goeyOptions = displayDuration ? { ...rest, timing: { displayDuration } } : rest;
  void load().then(
    (m) => m.gooeyToast[kind](message, goeyOptions as GooeyToastOptions),
    // Chunk-nya tidak bisa dimuat (offline, belum ter-cache). Aksinya sendiri
    // sudah berhasil — kehilangan notifikasinya jauh lebih baik daripada
    // unhandled rejection.
    () => {},
  );
}

export const toast = {
  success: (message: string, options?: ToastOptions): void => show('success', message, options),
  error: (message: string, options?: ToastOptions): void => show('error', message, options),
  info: (message: string, options?: ToastOptions): void => show('info', message, options),
};
