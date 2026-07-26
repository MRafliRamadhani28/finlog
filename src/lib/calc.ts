import type { Account, AccountBalance, Expense, Income, MonthDataFull, Piutang } from '../types';
import { EXPENSE_CATS } from '../types';

/**
 * Bandingkan accountId longgar (app lama pakai `==` karena sebagian data lama
 * menyimpan id sebagai string). `null`/`undefined` tidak pernah cocok.
 */
export function sameAccount(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Number(a) === Number(b);
}

/**
 * Income yang dihitung sebagai pemasukan nyata.
 * Entry dengan `piutangLunasId` (legacy) DIKECUALIKAN — lihat catatan di tipe Income.
 */
export function cleanIncome(income: Income[]): Income[] {
  return income.filter((i) => !i.piutangLunasId);
}

/**
 * Saldo satu akun bank:
 *   alokasi gaji − penarikan tunai akun ini − pengeluaran akun ini
 * Expense `fromCash` dikecualikan supaya penarikan tunai tidak dihitung dua kali.
 */
export function getAccountBalance(accountId: number, d: MonthDataFull): AccountBalance {
  const alloc = d.salaryAllocations.find((x) => sameAccount(x.accountId, accountId));
  const allocAmt = alloc ? alloc.amount : 0;
  const cashOut = d.cashWithdrawals
    .filter((c) => sameAccount(c.accountId, accountId))
    .reduce((s, c) => s + c.amount, 0);
  const expOut = d.expenses
    .filter((e) => sameAccount(e.accountId, accountId) && !e.fromCash)
    .reduce((s, e) => s + e.amount, 0);
  return { allocAmt, cashOut, expOut, effective: allocAmt - cashOut - expOut };
}

export interface MonthTotals {
  salary: number;
  totalAdditional: number;
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  totalPlanned: number;
  plannedCount: number;
  shadowBalance: number;
  surplus: number;
  totalPiutangBelumLunas: number;
}

/** Semua angka panel saldo & ringkasan. `expenses` = sumber kebenaran arus keluar. */
export function monthTotals(d: MonthDataFull): MonthTotals {
  const salary = d.salary || 0;
  const totalAdditional = cleanIncome(d.income).reduce((s, i) => s + i.amount, 0);
  const totalIncome = salary + totalAdditional;
  const totalExpenses = d.expenses.reduce((s, e) => s + e.amount, 0);
  const currentBalance = totalIncome - totalExpenses;
  const unchecked = d.planned.filter((p) => !p.checked);
  const totalPlanned = unchecked.reduce((s, p) => s + p.amount, 0);
  return {
    salary,
    totalAdditional,
    totalIncome,
    totalExpenses,
    currentBalance,
    totalPlanned,
    plannedCount: unchecked.length,
    shadowBalance: currentBalance - totalPlanned,
    surplus: totalIncome - totalExpenses,
    totalPiutangBelumLunas: d.piutang
      .filter((p) => p.status === 'Belum Lunas')
      .reduce((s, p) => s + p.amount, 0),
  };
}

/**
 * Uang tunai yang sudah keluar dari rekening tapi belum dipertanggungjawabkan
 * lewat item — praktisnya sisa di dompet.
 *
 * Per penarikan di-floor ke 0: item yang melebihi nominal tarikan adalah salah
 * catat, bukan tunai negatif. Tanpa floor, satu penarikan yang kelebihan catat
 * akan memakan sisa tunai penarikan lain.
 */
export function cashOnHand(d: MonthDataFull): number {
  return d.cashWithdrawals.reduce((s, c) => {
    const tracked = c.items.reduce((n, i) => n + i.amount, 0);
    return s + Math.max(0, c.amount - tracked);
  }, 0);
}

/**
 * Expense yang tampil di tab Pengeluaran. Expense turunan piutang disembunyikan
 * saat piutangnya sudah Lunas (saldo sudah pulih).
 */
export function visibleExpenses(d: MonthDataFull): Expense[] {
  return d.expenses.filter((e) => {
    if (!e.fromPiutang) return true;
    const pt = d.piutang.find((p) => p.id === e.piutangId);
    return pt !== undefined && pt.status !== 'Lunas';
  });
}

/** Breakdown ringkasan per kategori — mengecualikan expense `fromPiutang`. */
export function categoryBreakdown(
  d: MonthDataFull,
): { cat: string; amount: number; pct: number }[] {
  const catExp = new Map<string, number>();
  for (const e of d.expenses) {
    if (e.fromPiutang) continue;
    catExp.set(e.category, (catExp.get(e.category) ?? 0) + e.amount);
  }
  const total = [...catExp.values()].reduce((s, v) => s + v, 0);
  return [...catExp.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({ cat, amount, pct: total ? (amount / total) * 100 : 0 }));
}

export interface BudgetRow {
  cat: string;
  spent: number;
  budget: number;
  pct: number;
}

/** Progress budget per kategori — mengecualikan expense `fromPiutang` & `fromCash`. */
export function budgetProgress(d: MonthDataFull): BudgetRow[] {
  const catExp = new Map<string, number>();
  for (const e of d.expenses) {
    if (e.fromPiutang || e.fromCash) continue;
    catExp.set(e.category, (catExp.get(e.category) ?? 0) + e.amount);
  }
  return EXPENSE_CATS.map((cat) => {
    const spent = catExp.get(cat) ?? 0;
    const budget = d.budgets[cat] ?? 0;
    return { cat, spent, budget, pct: budget ? Math.min((spent / budget) * 100, 100) : 0 };
  }).filter((r) => r.budget > 0 || r.spent > 0);
}

/** Akun yang punya aktivitas bulan ini (dipakai panel saldo). */
export function activeAccounts(
  accounts: Account[],
  d: MonthDataFull,
): { account: Account; balance: AccountBalance }[] {
  return accounts
    .map((account) => ({ account, balance: getAccountBalance(account.id, d) }))
    .filter(
      ({ balance }) => balance.allocAmt !== 0 || balance.cashOut !== 0 || balance.expOut !== 0,
    );
}

export function isOverdue(p: Piutang): boolean {
  return Boolean(p.due) && new Date(p.due) < new Date() && p.status !== 'Lunas';
}

export function totalAllocated(d: MonthDataFull): number {
  return d.salaryAllocations.reduce((s, a) => s + a.amount, 0);
}

/**
 * Filter baris transaksi: kata kunci bebas + kategori.
 *
 * Kata kunci dicocokkan ke deskripsi, catatan, dan kategori — sengaja bukan
 * nominal. Angka pendek seperti "50" jadi substring hampir semua nominal, dan
 * hasilnya lebih berisik daripada berguna.
 */
export function filterEntries<T extends { category: string; description: string; note?: string }>(
  rows: T[],
  query: string,
  category: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q && !category) return rows;
  return rows.filter((r) => {
    if (category && r.category !== category) return false;
    if (!q) return true;
    return (
      r.description.toLowerCase().includes(q) ||
      (r.note ?? '').toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });
}
