import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Account, MonthDataFull, WishlistItem } from '../types';
import {
  KEYS,
  loadAccounts,
  loadMonth,
  loadWishlist,
  monthKey,
  saveAccounts,
  saveMonth,
  saveWishlist,
  getFlag,
  setFlag,
} from '../lib/storage';
import { usePersistentState } from './usePersistentState';

// Adapter supaya semua storage dipakai lewat signature (key, value) yang sama.
const loadAcc = (): Account[] => loadAccounts();
const saveAcc = (_k: string, v: Account[]): void => saveAccounts(v);
const loadWl = (): WishlistItem[] => loadWishlist();
const saveWl = (_k: string, v: WishlistItem[]): void => saveWishlist(v);

interface AppValue {
  currentDate: Date;
  changeMonth: (dir: number) => void;
  data: MonthDataFull;
  updateMonth: (mutate: (d: MonthDataFull) => void) => void;
  /** Mutasi bulan lain lewat key-nya. Lihat implementasinya untuk alasannya. */
  updateMonthAt: (key: string, mutate: (d: MonthDataFull) => void) => void;
  accounts: Account[];
  updateAccounts: (mutate: (a: Account[]) => void) => void;
  wishlist: WishlistItem[];
  updateWishlist: (mutate: (w: WishlistItem[]) => void) => void;
  /** Timpa seluruh state — dipakai untuk mengurungkan hapus. */
  replaceMonth: (d: MonthDataFull) => void;
  replaceAccounts: (a: Account[]) => void;
  replaceWishlist: (w: WishlistItem[]) => void;
  /** Muat ulang semua data dari localStorage (dipakai setelah import/hapus). */
  reloadAll: () => void;
  balHidden: boolean;
  toggleBalHidden: () => void;
}

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }): ReactNode {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const key = monthKey(currentDate);

  const month = usePersistentState<MonthDataFull>(key, loadMonth, saveMonth);
  const accounts = usePersistentState<Account[]>(KEYS.accounts, loadAcc, saveAcc);
  const wishlist = usePersistentState<WishlistItem[]>(KEYS.wishlist, loadWl, saveWl);

  const [balHidden, setBalHidden] = useState(() => getFlag(KEYS.balHidden));

  const changeMonth = useCallback((dir: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  }, []);

  const toggleBalHidden = useCallback(() => {
    setBalHidden((prev) => {
      setFlag(KEYS.balHidden, !prev);
      return !prev;
    });
  }, []);

  /**
   * Ubah data bulan yang sedang TIDAK dibuka.
   *
   * Dipakai piutang lintas bulan: statusnya harus berubah di bulan tempat ia
   * dicatat, karena di situlah expense turunannya tinggal. Menulisnya ke bulan
   * aktif akan memindahkan arus kas ke bulan yang salah.
   *
   * Kalau key-nya ternyata bulan aktif, jalurnya dibelokkan ke `month.update`
   * supaya state React tidak jadi basi terhadap isi localStorage.
   */
  const updateMonthAt = useCallback(
    (k: string, mutate: (d: MonthDataFull) => void) => {
      if (k === key) {
        month.update(mutate);
        return;
      }
      const d = loadMonth(k);
      mutate(d);
      saveMonth(k, d);
    },
    [key, month],
  );

  const reloadAll = useCallback(() => {
    month.reload();
    accounts.reload();
    wishlist.reload();
  }, [month, accounts, wishlist]);

  const value = useMemo<AppValue>(
    () => ({
      currentDate,
      changeMonth,
      data: month.value,
      updateMonth: month.update,
      updateMonthAt,
      accounts: accounts.value,
      updateAccounts: accounts.update,
      wishlist: wishlist.value,
      updateWishlist: wishlist.update,
      replaceMonth: month.replace,
      replaceAccounts: accounts.replace,
      replaceWishlist: wishlist.replace,
      reloadAll,
      balHidden,
      toggleBalHidden,
    }),
    [
      currentDate,
      changeMonth,
      month,
      updateMonthAt,
      accounts,
      wishlist,
      reloadAll,
      balHidden,
      toggleBalHidden,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus dipakai di dalam <AppProvider>');
  return ctx;
}
