import type { Piutang } from '../types';
import { monthTotals } from './calc';
import { fmtMonthLabel } from './format';
import { allFinanceKeys, loadMonth } from './storage';

export interface ForeignPiutang {
  /** Key bulan tempat piutang ini tersimpan, mis. `finance_2026_07`. */
  monthKey: string;
  /** Tanggal bulan itu (tanggal 1), dipakai untuk navigasi & urutan. */
  monthDate: Date;
  /** "Juli 2026" */
  monthLabel: string;
  piutang: Piutang;
}

/**
 * `finance_2026_07` jadi Date tanggal 1 bulan itu. `null` kalau bukan key
 * bulan — `allFinanceKeys()` juga mengembalikan `finance_accounts` dan
 * `finance_wishlist`.
 */
export function parseMonthKey(key: string): Date | null {
  const m = /^finance_(\d{4})_(\d{2})$/.exec(key);
  if (!m?.[1] || !m[2]) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Number(m[1]), month - 1, 1);
}

/**
 * Piutang yang belum lunas di bulan-bulan LAIN, urut dari yang paling lama.
 *
 * Piutang disimpan per bulan mengikuti skema app lama, jadi utang yang dicatat
 * Juli lenyap dari pandangan begitu user pindah ke Agustus — padahal uangnya
 * belum kembali. Fungsi ini menyapu seluruh key bulan supaya yang belum lunas
 * tetap terlihat dari bulan mana pun.
 *
 * Sengaja TIDAK memindahkan piutang ke key global: skema localStorage dibekukan
 * dan membaca lintas bulan sudah cukup, tanpa migrasi dan tanpa risiko data
 * user lama hilang.
 *
 * Status kosong (data lama) dihitung belum lunas — lebih baik tampil dan
 * diabaikan daripada hilang diam-diam.
 */
export function openPiutangElsewhere(currentKey: string): ForeignPiutang[] {
  const out: ForeignPiutang[] = [];
  for (const key of allFinanceKeys()) {
    if (key === currentKey) continue;
    const monthDate = parseMonthKey(key);
    if (!monthDate) continue;
    for (const piutang of loadMonth(key).piutang) {
      if (piutang?.status === 'Lunas') continue;
      out.push({ monthKey: key, monthDate, monthLabel: fmtMonthLabel(monthDate), piutang });
    }
  }
  return out.sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
}

/** Berapa bulan dari `from` ke `to` — argumen untuk `changeMonth()`. */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export interface MonthPoint {
  monthKey: string;
  monthDate: Date;
  /** "Jul 2026" — pendek, muat di label baris. */
  shortLabel: string;
  income: number;
  expenses: number;
  /** Pemasukan − pengeluaran. Bisa negatif. */
  net: number;
}

/**
 * Rekap semua bulan yang punya data, urut kronologis.
 *
 * Bulan yang benar-benar kosong (tanpa pemasukan maupun pengeluaran) dibuang:
 * key-nya bisa tercipta hanya karena user melintasinya saat navigasi, dan baris
 * nol di grafik tren cuma jadi derau.
 */
export function monthlyTrend(): MonthPoint[] {
  const out: MonthPoint[] = [];
  for (const key of allFinanceKeys()) {
    const monthDate = parseMonthKey(key);
    if (!monthDate) continue;
    const t = monthTotals(loadMonth(key));
    if (t.totalIncome === 0 && t.totalExpenses === 0) continue;
    out.push({
      monthKey: key,
      monthDate,
      shortLabel: monthDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
      income: t.totalIncome,
      expenses: t.totalExpenses,
      net: t.totalIncome - t.totalExpenses,
    });
  }
  return out.sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
}
