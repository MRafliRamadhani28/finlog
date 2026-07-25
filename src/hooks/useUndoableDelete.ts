import { useCallback } from 'react';
import type { Account, MonthDataFull, WishlistItem } from '../types';
import { toast } from '../lib/toast';
import { useApp } from './useApp';

/**
 * Hapus dengan tombol "Urungkan" di toast.
 *
 * Hapus di app ini bersifat cascade — membuang satu piutang juga membuang entry
 * pengeluarannya, dan itu menggeser saldo. Snapshot-nya gratis: state sudah
 * immutable, jadi objek sebelum mutasi cukup disimpan apa adanya lalu dipasang
 * kembali lewat `replace*`.
 */
export function useUndoableDelete(): {
  month: (label: string, mutate: (d: MonthDataFull) => void) => void;
  accounts: (label: string, mutate: (a: Account[]) => void) => void;
  wishlist: (label: string, mutate: (w: WishlistItem[]) => void) => void;
} {
  const {
    data,
    accounts,
    wishlist,
    updateMonth,
    updateAccounts,
    updateWishlist,
    replaceMonth,
    replaceAccounts,
    replaceWishlist,
  } = useApp();

  const month = useCallback(
    (label: string, mutate: (d: MonthDataFull) => void) => {
      const snapshot = data;
      updateMonth(mutate);
      toast.success(label, {
        action: { label: 'Urungkan', onClick: () => replaceMonth(snapshot) },
      });
    },
    [data, updateMonth, replaceMonth],
  );

  const accountsFn = useCallback(
    (label: string, mutate: (a: Account[]) => void) => {
      const snapshot = accounts;
      updateAccounts(mutate);
      toast.success(label, {
        action: { label: 'Urungkan', onClick: () => replaceAccounts(snapshot) },
      });
    },
    [accounts, updateAccounts, replaceAccounts],
  );

  const wishlistFn = useCallback(
    (label: string, mutate: (w: WishlistItem[]) => void) => {
      const snapshot = wishlist;
      updateWishlist(mutate);
      toast.success(label, {
        action: { label: 'Urungkan', onClick: () => replaceWishlist(snapshot) },
      });
    },
    [wishlist, updateWishlist, replaceWishlist],
  );

  return { month, accounts: accountsFn, wishlist: wishlistFn };
}
