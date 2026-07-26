import type { ReactNode } from 'react';
import { useApp } from '../hooks/useApp';
import { activeAccounts, cashOnHand, monthTotals } from '../lib/calc';
import { fmtRp } from '../lib/format';
import { AnimatedMoney, Money } from './Money';
import { Icon } from './Icon';

/**
 * Satu angka hero + tiga tile pendukung (arah 1c). Saldo Terkini sengaja jadi
 * satu-satunya angka besar: empat kartu setara seperti sebelumnya membuat mata
 * tidak punya titik masuk.
 *
 * Rencana Keluar tidak lagi punya angkanya sendiri di sini — hasil akhirnya
 * (Saldo Bayangan) yang ditampilkan, rinciannya ada di tab Rencana & Ringkasan.
 */
export function BalancePanel(): ReactNode {
  const { data, accounts } = useApp();
  const t = monthTotals(data);
  const tunai = cashOnHand(data);

  return (
    <div className="balance-panel">
      <div className="bal-hero">
        <div className="bal-label">Saldo Terkini</div>
        <div className="bal-amount">
          <AnimatedMoney value={t.currentBalance} signed weight="bold" />
        </div>
        <div className="bal-sub">
          {t.plannedCount > 0 ? (
            <>
              Saldo Bayangan{' '}
              <Money
                value={t.shadowBalance}
                signed
                tone={t.shadowBalance < 0 ? 'red' : 'yellow'}
              />{' '}
              · {t.plannedCount} rencana
            </>
          ) : (
            <>
              {fmtRp(t.totalIncome)} − {fmtRp(t.totalExpenses)}
            </>
          )}
        </div>
      </div>

      <div className="bal-stats">
        <div className="bal-stat">
          <div className="bal-stat-label">Masuk</div>
          <div className="bal-stat-val">
            <Money value={t.totalIncome} tone="green" weight="bold" />
          </div>
        </div>
        <div className="bal-stat">
          <div className="bal-stat-label">Keluar</div>
          <div className="bal-stat-val">
            <Money value={t.totalExpenses} tone="red" weight="bold" />
          </div>
        </div>
        <div className="bal-stat">
          <div className="bal-stat-label">Tunai</div>
          <div className="bal-stat-val">
            <Money value={tunai} tone="yellow" weight="bold" />
          </div>
        </div>
      </div>

      <div className="bal-accounts">
        <AccountBalances />
      </div>
    </div>
  );

  function AccountBalances(): ReactNode {
    if (accounts.length === 0) return null;
    const active = activeAccounts(accounts, data);
    if (active.length === 0) {
      return <div className="bal-no-acc">Belum ada alokasi ke akun bank</div>;
    }
    return (
      <>
        <div className="section-label">Saldo per Akun</div>
        <div className="bal-acc-grid">
          {active.map(({ account: a, balance: b }) => {
            const isNeg = b.effective < 0;
            const nearEmpty = !isNeg && b.effective > 0 && b.effective < b.allocAmt * 0.2;
            return (
              <div key={a.id} className="bal-acc-item">
                <div className="bal-acc-left">
                  <div className="bal-acc-dot acc-dot" style={{ background: a.color }} />
                  <div className="bal-acc-info">
                    <div className="bal-acc-name" title={a.name}>
                      {a.name}
                    </div>
                    <div className="bal-acc-bank" title={a.bank}>
                      {a.bank}
                    </div>
                  </div>
                </div>
                <div className="bal-acc-right">
                  <div className="bal-acc-amount">
                    <Money value={b.effective} signed tone={isNeg ? 'red' : 'green'} />
                  </div>
                  {isNeg && (
                    <div className="bal-acc-warn inline-warn inline-warn-red">
                      <Icon name="warn" size={12} /> Saldo minus
                    </div>
                  )}
                  {nearEmpty && (
                    <div className="bal-acc-warn inline-warn inline-warn-yellow">
                      <Icon name="near" size={12} /> Hampir habis
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
}
