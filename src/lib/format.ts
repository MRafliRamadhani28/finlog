import { CAT_COLORS, FALLBACK_CAT_COLOR } from './constants';

/** `Rp x.xxx` — selalu nilai absolut, tanda minus ditambahkan pemanggil. */
export function fmtRp(n: number): string {
  if (Number.isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
}

export function fmtDate(d: string | undefined | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** `YYYY-MM-DD` hari ini. */
export function today(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export function fmtMonthLabel(date: Date): string {
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/**
 * Tanggal default untuk form, mengikuti bulan yang sedang dibuka.
 *
 * Kalau memakai `today()` begitu saja, menambah transaksi sambil menelusuri
 * bulan lampau akan menyimpan tanggal hari ini ke dalam data bulan itu.
 */
export function defaultDateFor(monthDate: Date): string {
  const now = new Date();
  if (monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth()) {
    return today();
  }
  return `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Resolve warna (hex, `rgb(...)`, atau `var(--x)`) jadi triplet `"r,g,b"` untuk
 * dipakai di `rgba(${...},.12)`. Sama persis dengan app lama: CSS var dibaca
 * lewat getComputedStyle, dengan fallback ke varian `-rgb`.
 */
export function hexToRgb(color: string | undefined): string {
  if (!color) return '143,163,200';
  const s = getComputedStyle(document.documentElement);
  const resolveVar = (val: string): string => {
    if (val.startsWith('var(')) {
      const match = /var\((--[^)]+)\)/.exec(val);
      if (!match?.[1]) return val;
      const name = match[1];
      const rgb = s.getPropertyValue(name + '-rgb').trim();
      if (rgb) return rgb;
      return resolveVar(s.getPropertyValue(name).trim());
    }
    if (val.startsWith('rgb')) return val.replace(/rgba?\(|\)/g, '');
    return val;
  };
  const final = resolveVar(color);
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(final);
  return r
    ? `${parseInt(r[1] ?? '0', 16)},${parseInt(r[2] ?? '0', 16)},${parseInt(r[3] ?? '0', 16)}`
    : final || '143,163,200';
}

export function catColor(category: string): string {
  return CAT_COLORS[category] ?? FALLBACK_CAT_COLOR;
}

/** Style badge kategori: background transparan + teks berwarna. */
export function catBadgeStyle(category: string): { background: string; color: string } {
  const color = catColor(category);
  return { background: `rgba(${hexToRgb(color)},.12)`, color };
}

/** "Hari ini" / "3 hari lalu" / "2 bulan lalu" / "1 tahun lalu". */
export function daysAgo(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return '1 hari lalu';
  if (diff < 30) return diff + ' hari lalu';
  if (diff < 365) return Math.floor(diff / 30) + ' bulan lalu';
  return Math.floor(diff / 365) + ' tahun lalu';
}
