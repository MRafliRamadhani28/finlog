import type { Account, MonthDataFull, WishlistItem } from '../types';

/**
 * Semua akses localStorage lewat file ini. Key & bentuk data SAMA PERSIS dengan
 * app lama (keputusan D-2) — tanpa versioning, tanpa migrasi.
 */
export const KEYS = {
  accounts: 'finance_accounts',
  wishlist: 'finance_wishlist',
  balHidden: 'keuangan_bal_hidden',
  tutorialDone: 'keuangan_tutorial_done',
  cloud: 'finlog_cloud',
} as const;

/** `finance_2026_07` */
export function monthKey(date: Date): string {
  return `finance_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultMonthData(): MonthDataFull {
  return {
    salary: 0,
    salaryAllocations: [],
    income: [],
    expenses: [],
    cashWithdrawals: [],
    planned: [],
    piutang: [],
    budgets: {},
  };
}

/** Baca JSON dengan fallback aman kalau key kosong / data korup. */
function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

let financeListener: (() => void) | null = null;

export function onFinanceChange(cb: (() => void) | null): void {
  financeListener = cb;
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Kuota penuh / storage diblokir. Biarkan pemanggil yang memberi tahu user.
    console.error('Gagal menyimpan ke localStorage:', e);
    throw e;
  }
  if (isFinanceKey(key)) financeListener?.();
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/**
 * Paksa bentuk data ke skema yang benar.
 *
 * Import JSON menerima apa pun dari user. Tanpa ini, satu field bertipe salah
 * (mis. `income` berupa string) bikin `cleanIncome()` melempar `.filter is not
 * a function` dan seluruh app blank — termasuk tab Data yang dipakai untuk
 * memperbaikinya.
 */
export function coerceMonthData(raw: unknown): MonthDataFull {
  const d = defaultMonthData();
  if (raw === null || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  return {
    salary: typeof o['salary'] === 'number' && Number.isFinite(o['salary']) ? o['salary'] : 0,
    salaryAllocations: asArray(o['salaryAllocations']),
    income: asArray(o['income']),
    expenses: asArray(o['expenses']),
    cashWithdrawals: asArray<MonthDataFull['cashWithdrawals'][number]>(o['cashWithdrawals']).map(
      (c) => ({ ...c, items: asArray(c?.items) }),
    ),
    planned: asArray(o['planned']),
    piutang: asArray(o['piutang']),
    budgets:
      o['budgets'] !== null && typeof o['budgets'] === 'object' && !Array.isArray(o['budgets'])
        ? (o['budgets'] as MonthDataFull['budgets'])
        : {},
  };
}

export function loadMonth(key: string): MonthDataFull {
  return coerceMonthData(readJSON<unknown>(key, {}));
}

export function saveMonth(key: string, data: MonthDataFull): void {
  writeJSON(key, data);
}

export function removeMonth(key: string): void {
  localStorage.removeItem(key);
  financeListener?.();
}

export function loadAccounts(): Account[] {
  const v = readJSON<Account[]>(KEYS.accounts, []);
  return Array.isArray(v) ? v : [];
}

export function saveAccounts(a: Account[]): void {
  writeJSON(KEYS.accounts, a);
}

export function loadWishlist(): WishlistItem[] {
  const v = readJSON<WishlistItem[]>(KEYS.wishlist, []);
  return Array.isArray(v) ? v : [];
}

export function saveWishlist(w: WishlistItem[]): void {
  writeJSON(KEYS.wishlist, w);
}

export function getFlag(key: string): boolean {
  return localStorage.getItem(key) === '1';
}

export function setFlag(key: string, on: boolean): void {
  localStorage.setItem(key, on ? '1' : '0');
}

/** Key milik app ini: semua `finance_*`. */
function isFinanceKey(k: string): boolean {
  return k.startsWith('finance_');
}

export function allFinanceKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isFinanceKey(k)) keys.push(k);
  }
  return keys;
}

/** Dump semua data (semua bulan + akun + wishlist) untuk export JSON. */
export function exportAll(): Record<string, unknown> {
  const all: Record<string, unknown> = {};
  for (const k of allFinanceKeys()) {
    try {
      const raw = localStorage.getItem(k);
      if (raw !== null) all[k] = JSON.parse(raw);
    } catch {
      // Key korup dilewati, jangan gagalkan seluruh export.
    }
  }
  return all;
}

/** Key valid dari JSON import. Kosong = format tidak dikenali. */
export function importableKeys(parsed: Record<string, unknown>): string[] {
  return Object.keys(parsed).filter(isFinanceKey);
}

export function importAll(parsed: Record<string, unknown>, keys: string[]): void {
  for (const k of keys) writeJSON(k, parsed[k]);
}

export function deleteAllData(): void {
  for (const k of allFinanceKeys()) localStorage.removeItem(k);
  financeListener?.();
}

export interface CloudState {
  email: string;
  dirty: boolean;
}

export function loadCloudState(): CloudState | null {
  const v = readJSON<Partial<CloudState> | null>(KEYS.cloud, null);
  return v && typeof v.email === 'string' ? { email: v.email, dirty: v.dirty === true } : null;
}

export function saveCloudState(s: CloudState | null): void {
  try {
    if (s) localStorage.setItem(KEYS.cloud, JSON.stringify(s));
    else localStorage.removeItem(KEYS.cloud);
  } catch (e) {
    console.error('Gagal menyimpan status cloud:', e);
  }
}
