import type { ReactNode } from 'react';
import { useApp } from '../hooks/useApp';
import { activeAccounts, monthTotals } from '../lib/calc';
import { fmtRp } from '../lib/format';
import { AnimatedMoney, Money } from './Money';
import { Icon } from './Icon';

export function BalancePanel(): ReactNode {
  const { data, accounts } = useApp();
  const t = monthTotals(data);

  return (
    <div className="balance-panel">
      <div className="bal-card green">
        <div className="bal-label">Saldo Terkini</div>
        <div className="bal-amount">
          <AnimatedMoney value={t.currentBalance} signed weight="bold" />
        </div>
        <div className="bal-sub">
          {fmtRp(t.totalIncome)} − {fmtRp(t.totalExpenses)}
        </div>
        <div className="bal-accounts">
          <AccountBalances />
        </div>
      </div>

      <div className="bal-card red">
        <div className="bal-label">Total Rencana Keluar</div>
        <div className="bal-amount">
          <AnimatedMoney value={t.totalPlanned} weight="strong" />
        </div>
        <div className="bal-sub">{t.plannedCount} item belum terceklis</div>
      </div>

      <div className="bal-card yellow">
        <div className="bal-label">Saldo Bayangan</div>
        <div className="bal-amount">
          <AnimatedMoney
            value={t.shadowBalance}
            signed
            weight="strong"
            tone={t.shadowBalance < 0 ? 'red' : 'yellow'}
          />
        </div>
        <div className="bal-sub">Saldo − Rencana Keluar</div>
      </div>

      <div className="bal-card blue">
        <div className="bal-label">Total Pemasukan</div>
        <div className="bal-amount">
          <AnimatedMoney value={t.totalIncome} weight="strong" />
        </div>
        <div className="bal-sub">
          {fmtRp(t.salary)} + {fmtRp(t.totalAdditional)}
        </div>
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
