import type { Account, Expense, MonthDataFull } from '../types';
import { nextId } from './id';

/**
 * Mutasi murni atas draft `MonthDataFull`. Semua aturan tautan antar-entry
 * (expense turunan tunai/piutang/rencana + cascade hapus) tinggal di sini,
 * bukan di komponen UI.
 *
 * ID pakai `Date.now()` lewat `nextId()` supaya tetap kompatibel dengan data
 * lama tapi dijamin unik. Tautan antar-entry lewat `cashId` / `piutangId` /
 * `plannedId`.
 */

export interface CashInput {
  date: string;
  accountId: number | null;
  amount: number;
  description: string;
}

export function addCashWithdrawal(d: MonthDataFull, input: CashInput, accounts: Account[]): void {
  const id = nextId(d.cashWithdrawals);
  d.cashWithdrawals.push({
    id,
    date: input.date,
    accountId: input.accountId,
    amount: input.amount,
    description: input.description,
    items: [],
  });
  const acc = accounts.find((a) => a.id === input.accountId);
  d.expenses.push({
    id: nextId(d.expenses, id + 1),
    cashId: id,
    date: input.date,
    category: 'Tunai',
    description: `Tarik Tunai: ${input.description}${acc ? ` (${acc.bank} ${acc.name})` : ''}`,
    amount: input.amount,
    accountId: input.accountId,
    fromCash: true,
  });
}

export function deleteCashWithdrawal(d: MonthDataFull, id: number): void {
  d.cashWithdrawals = d.cashWithdrawals.filter((c) => c.id !== id);
  d.expenses = d.expenses.filter((e) => e.cashId !== id);
}

export interface PiutangInput {
  name: string;
  date: string;
  amount: number;
  due: string;
  note: string;
  accountId: number | null;
}

export function addPiutang(d: MonthDataFull, input: PiutangInput): void {
  const id = nextId(d.piutang);
  d.piutang.push({
    id,
    name: input.name,
    date: input.date,
    amount: input.amount,
    due: input.due,
    note: input.note,
    status: 'Belum Lunas',
    accountId: input.accountId,
  });
  d.expenses.push({
    id: nextId(d.expenses, id + 1),
    piutangId: id,
    date: input.date,
    category: 'Piutang',
    description: 'Piutang ke: ' + input.name,
    amount: input.amount,
    note: input.note,
    accountId: input.accountId,
    fromPiutang: true,
  });
}

/** Expense turunan piutang, dipakai saat membuat ulang setelah toggle/hapus. */
function piutangExpense(d: MonthDataFull, pt: MonthDataFull['piutang'][number]): Expense {
  return {
    id: nextId(d.expenses),
    piutangId: pt.id,
    date: pt.date,
    category: 'Piutang',
    description: 'Piutang ke: ' + pt.name,
    amount: pt.amount,
    note: pt.note || '',
    // Diambil dari piutang-nya supaya saldo per akun tidak rusak setelah toggle.
    accountId: pt.accountId ?? null,
    fromPiutang: true,
  };
}

/**
 * Belum Lunas → Lunas: hapus expense tertaut (saldo pulih).
 * Lunas → Belum Lunas: buat ulang expense-nya, lengkap dengan rekening sumber.
 */
export function togglePiutangStatus(d: MonthDataFull, id: number): void {
  const pt = d.piutang.find((p) => p.id === id);
  if (!pt) return;
  if (pt.status === 'Belum Lunas') {
    pt.status = 'Lunas';
    // Data lama belum menyimpan accountId di piutang — pungut dari expense
    // sebelum dibuang, supaya toggle balik tidak kehilangan tautan rekening.
    if (pt.accountId === undefined) {
      pt.accountId = d.expenses.find((e) => e.piutangId === id)?.accountId ?? null;
    }
    d.expenses = d.expenses.filter((e) => e.piutangId !== id);
    d.income = d.income.filter((i) => i.piutangLunasId !== id);
  } else {
    pt.status = 'Belum Lunas';
    d.expenses.push(piutangExpense(d, pt));
  }
}

/**
 * Tandai lunas TANPA menghapus expense turunannya.
 *
 * Dipakai saat pelunasan dicatat sebagai pemasukan di bulan lain: uangnya
 * memang benar-benar keluar di bulan ini, jadi arus keluarnya harus tetap
 * tercatat di sini. Yang memulihkan saldo adalah entry pemasukan di bulan
 * pelunasan, lewat `addPiutangSettlement`.
 */
export function markPiutangLunasKeepExpense(d: MonthDataFull, id: number): void {
  const pt = d.piutang.find((p) => p.id === id);
  if (!pt || pt.status === 'Lunas') return;
  if (pt.accountId === undefined) {
    pt.accountId = d.expenses.find((e) => e.piutangId === id)?.accountId ?? null;
  }
  pt.status = 'Lunas';
}

/**
 * Catat uang piutang yang kembali sebagai pemasukan bulan ini.
 *
 * Sengaja TANPA `piutangLunasId`: entry yang punya field legacy itu dikecualikan
 * dari total oleh `cleanIncome`, jadi saldonya justru tidak akan bertambah.
 * Yang ini memang harus bertambah.
 */
export function addPiutangSettlement(
  d: MonthDataFull,
  input: { name: string; amount: number; fromMonthLabel: string },
  date: string,
): void {
  d.income.push({
    id: nextId(d.income),
    date,
    category: 'Lainnya',
    description: `Pelunasan piutang: ${input.name}`,
    amount: input.amount,
    note: `Dicatat di ${input.fromMonthLabel}`,
  });
}

export function deletePiutang(d: MonthDataFull, id: number): void {
  d.piutang = d.piutang.filter((p) => p.id !== id);
  d.expenses = d.expenses.filter((e) => e.piutangId !== id);
  d.income = d.income.filter((i) => i.piutangLunasId !== id);
}

/**
 * Hapus income. Kalau income itu entry legacy pelunasan piutang
 * (`piutangLunasId`), piutangnya dikembalikan ke Belum Lunas + expense-nya
 * dibuat ulang.
 */
export function deleteIncome(d: MonthDataFull, id: number): void {
  const item = d.income.find((i) => i.id === id);
  d.income = d.income.filter((i) => i.id !== id);
  if (!item?.piutangLunasId) return;
  const pt = d.piutang.find((p) => p.id === item.piutangLunasId);
  if (!pt) return;
  pt.status = 'Belum Lunas';
  if (!d.expenses.find((e) => e.piutangId === pt.id)) {
    d.expenses.push(piutangExpense(d, pt));
  }
}

/** Rencana dicentang → jadi pengeluaran aktual pada `date`. */
export function checkPlanned(
  d: MonthDataFull,
  plannedId: number,
  accountId: number | null,
  date: string,
): void {
  const item = d.planned.find((p) => p.id === plannedId);
  if (!item || item.checked) return;
  d.expenses.push({
    id: nextId(d.expenses),
    date,
    category: item.category,
    description: item.description,
    amount: item.amount,
    note: 'Dari rencana pengeluaran',
    fromPlanned: true,
    plannedId,
    accountId,
  });
  item.checked = true;
}

/**
 * Batal centang → hapus expense turunannya.
 *
 * Utamakan tautan `plannedId`. Entry lama tidak punya tautan itu, jadi jatuh ke
 * pencocokan deskripsi+jumlah — tapi hanya SATU yang dibuang. App lama memakai
 * `filter` yang membuang semua yang cocok, sehingga dua rencana kembar yang
 * dicentang keduanya akan kehilangan dua pengeluaran sekaligus.
 */
export function uncheckPlanned(d: MonthDataFull, plannedId: number): void {
  const item = d.planned.find((p) => p.id === plannedId);
  if (!item || !item.checked) return;
  item.checked = false;

  let idx = d.expenses.findIndex((e) => e.fromPlanned && e.plannedId === plannedId);
  if (idx === -1) {
    idx = d.expenses.findIndex(
      (e) =>
        e.fromPlanned &&
        e.plannedId === undefined &&
        e.description === item.description &&
        e.amount === item.amount,
    );
  }
  if (idx > -1) d.expenses.splice(idx, 1);
}

export function setAllocation(d: MonthDataFull, accountId: number, amount: number): void {
  const idx = d.salaryAllocations.findIndex((x) => x.accountId === accountId);
  if (amount > 0) {
    if (idx > -1) d.salaryAllocations[idx]!.amount = amount;
    else d.salaryAllocations.push({ accountId, amount });
  } else if (idx > -1) {
    d.salaryAllocations.splice(idx, 1);
  }
}
