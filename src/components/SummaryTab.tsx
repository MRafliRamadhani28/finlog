import type { ReactNode } from 'react';
import { useApp } from '../hooks/useApp';
import { categoryBreakdown, monthTotals } from '../lib/calc';
import { catColor, fmtRp } from '../lib/format';
import { CardHeader } from './Modal';
import { Money } from './Money';

export function SummaryTab(): ReactNode {
  const { data, accounts } = useApp();
  const t = monthTotals(data);
  const cats = categoryBreakdown(data);
  const allocated = data.salaryAllocations.filter((alloc) =>
    accounts.some((a) => a.id === alloc.accountId),
  );

  return (
    <>
      <div className="summary-grid">
        <div className="card">
          <CardHeader dot="green" title="Ringkasan Pemasukan" />
          <Row label="Gaji Pokok" value={t.salary} tone="gold" />
          <Row label="Penghasilan Tambahan" value={t.totalAdditional} tone="blue" />
          <Row label="Total Pemasukan" value={t.totalIncome} tone="green" bold />
        </div>
        <div className="card">
          <CardHeader dot="red" title="Ringkasan Pengeluaran" />
          <Row label="Total Pengeluaran" value={t.totalExpenses} tone="red" />
          <Row label="Rencana Keluar" value={t.totalPlanned} tone="yellow" />
          <Row label="Piutang Belum Lunas" value={t.totalPiutangBelumLunas} tone="purple" />
          <Row
            label="Sisa / Surplus"
            value={t.surplus}
            tone={t.surplus >= 0 ? 'green' : 'red'}
            signed
            bold
          />
        </div>
      </div>

      <div className="card">
        <CardHeader dot="yellow" title="Pengeluaran per Kategori" />
        {cats.length === 0 ? (
          <div className="empty">
            <p>Belum ada data pengeluaran bulan ini.</p>
          </div>
        ) : (
          cats.map((c) => {
            const color = catColor(c.cat);
            return (
              <div key={c.cat} className="cat-row">
                <div className="cat-row-head">
                  <span className="cat-name" style={{ color }}>
                    {c.cat}
                  </span>
                  <span className="num">
                    {fmtRp(c.amount)} <span className="cell-muted">({c.pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${c.pct}%`, background: color }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <CardHeader dot="blue" title="Alokasi Gaji per Akun" />
        {allocated.length === 0 ? (
          <div className="empty">
            <p>Belum ada alokasi akun bank bulan ini.</p>
          </div>
        ) : (
          <div className="stack">
            {accounts.map((a) => {
              const alloc = data.salaryAllocations.find((x) => x.accountId === a.id);
              if (!alloc) return null;
              const pct = t.salary ? ((alloc.amount / t.salary) * 100).toFixed(0) : '0';
              return (
                <div key={a.id} className="alloc-row">
                  <div className="acc-dot acc-dot-lg" style={{ background: a.color }} />
                  <div className="alloc-name">
                    {a.bank} · {a.name}
                  </div>
                  <span className="num num-strong" style={{ color: a.color }}>
                    {fmtRp(alloc.amount)}
                  </span>
                  <div className="alloc-pct num">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
  signed,
}: {
  label: string;
  value: number;
  tone: 'green' | 'red' | 'yellow' | 'purple' | 'gold' | 'blue';
  bold?: boolean;
  signed?: boolean;
}): ReactNode {
  return (
    <div className="total-row">
      <span className={'total-label' + (bold ? ' total-label-strong' : '')}>{label}</span>
      <span className="total-val">
        <Money value={value} tone={tone} signed={signed} weight={bold ? 'bold' : 'strong'} />
      </span>
    </div>
  );
}
