/**
 * Tipe data aplikasi. Bentuknya SAMA PERSIS dengan skema localStorage app lama
 * (keputusan D-2: skema dipertahankan apa adanya, tanpa migrasi/versioning).
 */

export const EXPENSE_CATS = [
  'Makanan',
  'Transport',
  'Tagihan',
  'Kesehatan',
  'Hiburan',
  'Belanja',
  'Pendidikan',
  'Lainnya',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATS)[number];

export const INCOME_CATS = ['Freelance', 'Bonus', 'Lainnya'] as const;
export type IncomeCategory = (typeof INCOME_CATS)[number];

/** Kategori yang bisa muncul di data: kategori manual + kategori otomatis. */
export type AnyCategory = ExpenseCategory | IncomeCategory | 'Tunai' | 'Piutang' | 'Gaji';

export type PiutangStatus = 'Belum Lunas' | 'Lunas';

export const WL_PRIORITIES = ['biasa', 'pengen', 'banget', 'impian', 'segera'] as const;
export type WishlistPriority = (typeof WL_PRIORITIES)[number];

export const WL_STATUSES = ['wishlist', 'saving', 'achieved'] as const;
export type WishlistStatus = (typeof WL_STATUSES)[number];

export interface Account {
  id: number;
  name: string;
  bank: string;
  number: string;
  color: string;
}

export interface SalaryAllocation {
  accountId: number;
  amount: number;
}

export interface Income {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  note: string;
  /**
   * @deprecated Legacy. Tidak pernah ditulis lagi sejak versi lama, tapi data
   * user lama masih bisa punya field ini. Entry income yang punya
   * `piutangLunasId` DIKECUALIKAN dari total pemasukan & dari daftar income —
   * kalau read-logic ini dibuang, total pemasukan user lama jadi dobel.
   */
  piutangLunasId?: number;
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  note?: string;
  accountId: number | null;
  /** Berasal dari rencana yang dicentang. */
  fromPlanned?: boolean;
  /**
   * Menautkan ke Planned.id. Entry lama (sebelum tautan ini ada) tidak punya
   * field ini — batal-centang jatuh ke pencocokan deskripsi+jumlah.
   */
  plannedId?: number;
  /** Berasal dari penarikan tunai; `cashId` menautkan ke CashWithdrawal.id. */
  fromCash?: boolean;
  cashId?: number;
  /** Berasal dari piutang; `piutangId` menautkan ke Piutang.id. */
  fromPiutang?: boolean;
  piutangId?: number;
}

export interface CashItem {
  id: number;
  description: string;
  category: string;
  amount: number;
}

export interface CashWithdrawal {
  id: number;
  date: string;
  accountId: number | null;
  amount: number;
  description: string;
  items: CashItem[];
}

export interface Planned {
  id: number;
  category: string;
  description: string;
  amount: number;
  checked: boolean;
}

export interface Piutang {
  id: number;
  name: string;
  date: string;
  amount: number;
  due: string;
  note: string;
  status: PiutangStatus;
  /**
   * Rekening sumber. Disimpan di sini supaya tautan ke akun tidak hilang saat
   * status di-toggle Lunas ↔ Belum Lunas (expense-nya dihapus & dibuat ulang).
   * Data lama tidak punya field ini.
   */
  accountId?: number | null;
}

export type Budgets = Partial<Record<string, number>>;

export interface MonthData {
  salary: number;
  salaryAllocations: SalaryAllocation[];
  income: Income[];
  expenses: Expense[];
  cashWithdrawals: CashWithdrawal[];
  planned: Planned[];
  budgets: Budgets;
}

export interface WishlistItem {
  id: number;
  name: string;
  emoji: string;
  price: number;
  priority: WishlistPriority;
  status: WishlistStatus;
  note: string;
  dateAdded: string;
}

/** MonthData + piutang (dipisah supaya urutan field mengikuti app lama). */
export interface MonthDataFull extends MonthData {
  piutang: Piutang[];
}

/** Hasil hitung saldo satu akun bank. */
export interface AccountBalance {
  allocAmt: number;
  cashOut: number;
  expOut: number;
  effective: number;
}

export type TabName =
  | 'pemasukan'
  | 'pengeluaran'
  | 'tunai'
  | 'rencana'
  | 'piutang'
  | 'akun'
  | 'budget'
  | 'wishlist'
  | 'ringkasan'
  | 'data'
  | 'panduan';
