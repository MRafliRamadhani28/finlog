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
}

function show(kind: 'success' | 'error', message: string, options?: ToastOptions): void {
  void load().then((m) => m.gooeyToast[kind](message, options as GooeyToastOptions));
}

export const toast = {
  success: (message: string, options?: ToastOptions): void => show('success', message, options),
  error: (message: string, options?: ToastOptions): void => show('error', message, options),
};
