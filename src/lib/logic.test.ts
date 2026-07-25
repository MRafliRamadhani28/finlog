import { describe, expect, it } from 'vitest';
import type { MonthDataFull } from '../types';
import { coerceMonthData, defaultMonthData } from './storage';
import { budgetProgress, categoryBreakdown, getAccountBalance, monthTotals, visibleExpenses } from './calc';
import {
  addCashWithdrawal,
  addPiutang,
  checkPlanned,
  deleteCashWithdrawal,
  deleteIncome,
  deletePiutang,
  setAllocation,
  togglePiutangStatus,
  uncheckPlanned,
} from './mutations';

const BCA = { id: 1, name: 'Utama', bank: 'BCA', number: '', color: '#4d9fff' };

function seed(): MonthDataFull {
  const d = defaultMonthData();
  d.salary = 5_000_000;
  setAllocation(d, BCA.id, 5_000_000);
  return d;
}

describe('saldo', () => {
  it('Saldo Terkini = pemasukan − semua expense; Bayangan = − rencana belum dicentang', () => {
    const d = seed();
    d.income.push({ id: 1, date: '', category: 'Bonus', description: 'b', amount: 1_000_000, note: '' });
    d.expenses.push({ id: 2, date: '', category: 'Makanan', description: 'm', amount: 200_000, accountId: null });
    d.planned.push({ id: 3, category: 'Tagihan', description: 'listrik', amount: 300_000, checked: false });

    const t = monthTotals(d);
    expect(t.totalIncome).toBe(6_000_000);
    expect(t.currentBalance).toBe(5_800_000);
    expect(t.shadowBalance).toBe(5_500_000);
  });

  it('income legacy piutangLunasId dikecualikan dari total (kalau tidak, dobel)', () => {
    const d = seed();
    d.income.push({ id: 1, date: '', category: 'Lainnya', description: 'pelunasan', amount: 500_000, note: '', piutangLunasId: 99 });
    expect(monthTotals(d).totalAdditional).toBe(0);
  });

  it('saldo akun mengecualikan expense fromCash supaya tarik tunai tidak dobel', () => {
    const d = seed();
    addCashWithdrawal(d, { date: '2026-07-01', accountId: BCA.id, amount: 1_000_000, description: 'ATM' }, [BCA]);
    const b = getAccountBalance(BCA.id, d);
    expect(b.cashOut).toBe(1_000_000);
    expect(b.expOut).toBe(0);
    expect(b.effective).toBe(4_000_000);
    // tapi arus keluar total tetap kehitung sekali lewat expenses
    expect(monthTotals(d).totalExpenses).toBe(1_000_000);
  });
});

describe('tunai', () => {
  it('tarik tunai bikin 1 withdrawal + 1 expense tertaut, hapus meng-cascade', () => {
    const d = seed();
    addCashWithdrawal(d, { date: '2026-07-01', accountId: BCA.id, amount: 500_000, description: 'mingguan' }, [BCA]);
    const cash = d.cashWithdrawals[0]!;
    const exp = d.expenses[0]!;
    expect(d.expenses).toHaveLength(1);
    expect(exp.cashId).toBe(cash.id);
    expect(exp.fromCash).toBe(true);
    expect(exp.description).toBe('Tarik Tunai: mingguan (BCA Utama)');

    deleteCashWithdrawal(d, cash.id);
    expect(d.cashWithdrawals).toHaveLength(0);
    expect(d.expenses).toHaveLength(0);
  });
});

describe('piutang', () => {
  it('lunas mengembalikan saldo, toggle balik membuat ulang expense', () => {
    const d = seed();
    addPiutang(d, { name: 'Budi', date: '2026-07-01', amount: 400_000, due: '', note: '', accountId: BCA.id });
    const pt = d.piutang[0]!;
    expect(monthTotals(d).currentBalance).toBe(4_600_000);
    expect(visibleExpenses(d)).toHaveLength(1);

    togglePiutangStatus(d, pt.id);
    expect(d.piutang[0]!.status).toBe('Lunas');
    expect(monthTotals(d).currentBalance).toBe(5_000_000);
    expect(visibleExpenses(d)).toHaveLength(0);

    togglePiutangStatus(d, pt.id);
    expect(d.piutang[0]!.status).toBe('Belum Lunas');
    expect(monthTotals(d).currentBalance).toBe(4_600_000);
    expect(visibleExpenses(d)).toHaveLength(1);
  });

  it('toggle bolak-balik mempertahankan rekening sumber (saldo akun tetap benar)', () => {
    const d = seed();
    addPiutang(d, { name: 'Budi', date: '', amount: 400_000, due: '', note: '', accountId: BCA.id });
    const pt = d.piutang[0]!;
    expect(getAccountBalance(BCA.id, d).effective).toBe(4_600_000);

    togglePiutangStatus(d, pt.id);
    expect(getAccountBalance(BCA.id, d).effective).toBe(5_000_000);

    togglePiutangStatus(d, pt.id);
    expect(d.expenses[0]!.accountId).toBe(BCA.id);
    expect(getAccountBalance(BCA.id, d).effective).toBe(4_600_000);
  });

  it('piutang lama tanpa accountId memungut rekening dari expense-nya', () => {
    const d = seed();
    d.piutang.push({ id: 10, name: 'Budi', date: '', amount: 400_000, due: '', note: '', status: 'Belum Lunas' });
    d.expenses.push({ id: 11, piutangId: 10, date: '', category: 'Piutang', description: 'Piutang ke: Budi', amount: 400_000, accountId: BCA.id, fromPiutang: true });

    togglePiutangStatus(d, 10);
    togglePiutangStatus(d, 10);
    expect(d.expenses[0]!.accountId).toBe(BCA.id);
    expect(getAccountBalance(BCA.id, d).effective).toBe(4_600_000);
  });

  it('hapus piutang meng-cascade expense turunannya', () => {
    const d = seed();
    addPiutang(d, { name: 'Budi', date: '', amount: 400_000, due: '', note: '', accountId: null });
    deletePiutang(d, d.piutang[0]!.id);
    expect(d.expenses).toHaveLength(0);
  });

  it('hapus income legacy pelunasan mengembalikan piutang ke Belum Lunas', () => {
    const d = seed();
    d.piutang.push({ id: 10, name: 'Budi', date: '', amount: 400_000, due: '', note: '', status: 'Lunas' });
    d.income.push({ id: 11, date: '', category: 'Lainnya', description: 'lunas', amount: 400_000, note: '', piutangLunasId: 10 });
    deleteIncome(d, 11);
    expect(d.piutang[0]!.status).toBe('Belum Lunas');
    expect(d.expenses).toHaveLength(1);
    expect(d.expenses[0]!.piutangId).toBe(10);
  });
});

describe('rencana', () => {
  it('centang bikin expense, batal centang menghapusnya lagi', () => {
    const d = seed();
    d.planned.push({ id: 3, category: 'Tagihan', description: 'listrik', amount: 300_000, checked: false });
    checkPlanned(d, 3, BCA.id, '2026-07-10');
    expect(d.planned[0]!.checked).toBe(true);
    expect(d.expenses[0]!.fromPlanned).toBe(true);
    expect(d.expenses[0]!.date).toBe('2026-07-10');
    expect(monthTotals(d).totalPlanned).toBe(0);

    uncheckPlanned(d, 3);
    expect(d.planned[0]!.checked).toBe(false);
    expect(d.expenses).toHaveLength(0);
    expect(monthTotals(d).totalPlanned).toBe(300_000);
  });

  it('dua rencana kembar: batal centang satu hanya menghapus satu expense', () => {
    const d = seed();
    d.planned.push({ id: 3, category: 'Tagihan', description: 'listrik', amount: 300_000, checked: false });
    d.planned.push({ id: 4, category: 'Tagihan', description: 'listrik', amount: 300_000, checked: false });
    checkPlanned(d, 3, null, '2026-07-10');
    checkPlanned(d, 4, null, '2026-07-10');
    expect(d.expenses).toHaveLength(2);

    uncheckPlanned(d, 3);
    expect(d.expenses).toHaveLength(1);
    expect(d.expenses[0]!.plannedId).toBe(4);
    expect(monthTotals(d).currentBalance).toBe(4_700_000);
  });

  it('expense lama tanpa plannedId tetap bisa dibatalkan (satu saja)', () => {
    const d = seed();
    d.planned.push({ id: 3, category: 'Tagihan', description: 'listrik', amount: 300_000, checked: true });
    d.expenses.push({ id: 9, date: '', category: 'Tagihan', description: 'listrik', amount: 300_000, accountId: null, fromPlanned: true });
    uncheckPlanned(d, 3);
    expect(d.expenses).toHaveLength(0);
  });
});

describe('id unik', () => {
  it('entry tertaut tidak menabrak id yang sudah dipakai', () => {
    const d = seed();
    const now = Date.now();
    // Simulasi tabrakan: expense yang sudah ada menempati id now dan now+1.
    d.expenses.push({ id: now, date: '', category: 'Makanan', description: 'a', amount: 1, accountId: null });
    d.expenses.push({ id: now + 1, date: '', category: 'Makanan', description: 'b', amount: 1, accountId: null });
    addCashWithdrawal(d, { date: '', accountId: null, amount: 100, description: 'x' }, []);
    const ids = d.expenses.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ringkasan & budget', () => {
  it('breakdown kategori mengecualikan fromPiutang; budget juga mengecualikan fromCash', () => {
    const d = seed();
    d.expenses.push({ id: 1, date: '', category: 'Makanan', description: 'a', amount: 100_000, accountId: null });
    addPiutang(d, { name: 'Budi', date: '', amount: 400_000, due: '', note: '', accountId: null });
    addCashWithdrawal(d, { date: '', accountId: null, amount: 200_000, description: 'x' }, []);

    const cats = categoryBreakdown(d);
    expect(cats.map((c) => c.cat)).toEqual(['Tunai', 'Makanan']);
    expect(cats.find((c) => c.cat === 'Piutang')).toBeUndefined();

    d.budgets['Makanan'] = 500_000;
    const rows = budgetProgress(d);
    expect(rows.find((r) => r.cat === 'Makanan')).toEqual({
      cat: 'Makanan',
      spent: 100_000,
      budget: 500_000,
      pct: 20,
    });
  });
});

describe('data rusak', () => {
  it('field bertipe salah dipaksa ke bentuk aman, bukan bikin app crash', () => {
    const d = coerceMonthData({
      salary: 'lima juta',
      income: 'bukan array',
      expenses: null,
      planned: { a: 1 },
      budgets: [1, 2],
      cashWithdrawals: [{ id: 1, amount: 100, items: 'rusak' }],
    });
    expect(d.salary).toBe(0);
    expect(d.income).toEqual([]);
    expect(d.expenses).toEqual([]);
    expect(d.planned).toEqual([]);
    expect(d.budgets).toEqual({});
    expect(d.cashWithdrawals[0]!.items).toEqual([]);
    // Yang penting: fungsi hitung tidak melempar.
    expect(() => monthTotals(d)).not.toThrow();
    expect(() => visibleExpenses(d)).not.toThrow();
    expect(() => budgetProgress(d)).not.toThrow();
  });

  it('null / string / array di root jatuh ke default', () => {
    for (const bad of [null, 'x', 42, []]) {
      expect(() => monthTotals(coerceMonthData(bad))).not.toThrow();
    }
  });
});

describe('alokasi gaji', () => {
  it('nilai 0 menghapus baris alokasi', () => {
    const d = seed();
    expect(d.salaryAllocations).toHaveLength(1);
    setAllocation(d, BCA.id, 0);
    expect(d.salaryAllocations).toHaveLength(0);
  });
});
