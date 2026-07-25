import { EXPENSE_CATS, type WishlistPriority, type WishlistStatus } from '../types';

export { EXPENSE_CATS };

/**
 * Keputusan D-4: warna kategori tetap CSS variable (didefinisikan di legacy.css).
 * Nilai di sini sengaja string `var(--cat-*)` persis seperti app lama supaya
 * inline style & `hexToRgb()` tetap bekerja tanpa perubahan.
 */
export const CAT_COLORS: Record<string, string> = {
  Makanan: 'var(--cat-makanan)',
  Transport: 'var(--cat-transport)',
  Tagihan: 'var(--cat-tagihan)',
  Kesehatan: 'var(--cat-kesehatan)',
  Hiburan: 'var(--cat-hiburan)',
  Belanja: 'var(--cat-belanja)',
  Pendidikan: 'var(--cat-pendidikan)',
  Lainnya: 'var(--cat-lainnya)',
  Freelance: 'var(--cat-freelance)',
  Bonus: 'var(--cat-bonus)',
  Piutang: 'var(--cat-piutang)',
  Gaji: 'var(--cat-gaji)',
  Tunai: 'var(--cat-tunai)',
};

export const FALLBACK_CAT_COLOR = '#8fa3c8';

export const PRIORITY_META: Record<WishlistPriority, { label: string; cls: string }> = {
  biasa: { label: 'Biasa', cls: 'priority-biasa' },
  pengen: { label: 'Pengen', cls: 'priority-pengen' },
  banget: { label: 'Pengen Banget', cls: 'priority-banget' },
  impian: { label: 'Impian', cls: 'priority-impian' },
  segera: { label: 'Segera!', cls: 'priority-segera' },
};

export const WL_RIBBON: Record<WishlistPriority, string> = {
  biasa: 'rgba(255,255,255,.1)',
  pengen: 'linear-gradient(90deg,#1d4ed8,#4d9fff)',
  banget: 'linear-gradient(90deg,#6d28d9,#a78bfa)',
  impian: 'linear-gradient(90deg,#92400e,#e8c96d)',
  segera: 'linear-gradient(90deg,#9f1239,#ff5e7a)',
};

export const WL_EMOJI_BG: Record<WishlistPriority, string> = {
  biasa: 'rgba(255,255,255,.05)',
  pengen: 'rgba(77,159,255,.12)',
  banget: 'rgba(167,139,250,.15)',
  impian: 'rgba(232,201,109,.12)',
  segera: 'rgba(255,94,122,.12)',
};

export const WL_STATUS_CONFIG: Record<
  WishlistStatus,
  { label: string; cls: string; next: string }
> = {
  wishlist: { label: 'Wishlist', cls: 'wl-status-wishlist', next: 'jadikan Ditabung' },
  saving: { label: 'Ditabung', cls: 'wl-status-saving', next: 'jadikan Tercapai' },
  achieved: { label: 'Tercapai', cls: 'wl-status-achieved', next: 'reset' },
};

/** Urutan sort grid wishlist (app lama: status dulu, baru prioritas). */
export const WL_PRIORITY_ORDER: Record<WishlistPriority, number> = {
  segera: 0,
  impian: 1,
  banget: 2,
  pengen: 3,
  biasa: 4,
};

export const WL_STATUS_ORDER: Record<WishlistStatus, number> = {
  saving: 0,
  wishlist: 1,
  achieved: 2,
};

/** Nilai hex tidak berubah — data akun lama tetap cocok. */
export const ACCOUNT_COLORS = [
  { value: '#4d9fff', label: 'Biru' },
  { value: '#22d98a', label: 'Hijau' },
  { value: '#a78bfa', label: 'Ungu' },
  { value: '#e8c96d', label: 'Kuning' },
  { value: '#ff5e7a', label: 'Merah' },
  { value: '#fb923c', label: 'Oranye' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#34d399', label: 'Teal' },
] as const;
