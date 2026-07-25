import { useCallback } from 'react';
import { getAccountBalance } from '../lib/calc';
import { fmtRp } from '../lib/format';
import { useApp } from './useApp';
import { useConfirm } from './useConfirm';

interface GuardOptions {
  /** Sedang mengedit: yang dicek adalah selisih biayanya, bukan total. */
  editing?: boolean;
}

/**
 * Konfirmasi "saldo akun tidak cukup" sebelum transaksi dicatat.
 *
 * Blok ini sebelumnya disalin identik di ExpenseTab, CashTab, PiutangTab, dan
 * PlannedTab — dengan tiga variasi kalimat yang tidak disengaja. Sekarang satu
 * tempat, satu kalimat.
 *
 * Mengembalikan `true` kalau boleh lanjut (saldo cukup, tanpa akun, atau user
 * menekan Lanjutkan).
 */
export function useBalanceGuard(): (
  accountId: number | null,
  cost: number,
  options?: GuardOptions,
) => Promise<boolean> {
  const { data } = useApp();
  const confirm = useConfirm();

  return useCallback(
    async (accountId, cost, options) => {
      if (!accountId || cost <= 0) return true;
      const bal = getAccountBalance(accountId, data);
      if (cost <= bal.effective) return true;

      const message = options?.editing
        ? `Perubahan ini melebihi saldo akun (${fmtRp(bal.effective)}). Tetap lanjutkan?`
        : bal.effective <= 0
          ? `Saldo akun ini sudah habis (${fmtRp(bal.effective)}). Tetap lanjutkan?`
          : `Jumlah (${fmtRp(cost)}) melebihi saldo akun (${fmtRp(bal.effective)}). Tetap lanjutkan?`;

      return confirm({
        title: '⚠️ Saldo Tidak Cukup',
        message,
        confirmLabel: 'Lanjutkan',
      });
    },
    [data, confirm],
  );
}
