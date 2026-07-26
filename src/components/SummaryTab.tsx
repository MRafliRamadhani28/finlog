import { useMemo, type ReactNode } from 'react';
import { useApp } from '../hooks/useApp';
import { categoryBreakdown, monthTotals } from '../lib/calc';
import { monthlyTrend, monthsBetween } from '../lib/crossMonth';
import { catColor, fmtRp } from '../lib/format';
import { monthKey } from '../lib/storage';
import type { TabName } from '../types';
import { CardHeader, EmptyState } from './Modal';
import { Icon, type IconName } from './Icon';
import { Money } from './Money';

export function SummaryTab({ onRecord }: { onRecord: (tab: TabName) => void }): ReactNode {
  const { data, accounts } = useApp();
  const t = monthTotals(data);
  const cats = categoryBreakdown(data);
  const allocated = data.salaryAllocations.filter((alloc) =>
    accounts.some((a) => a.id === alloc.accountId),
  );

  return (
    <>
      <QuickActions onRecord={onRecord} />

      <div className="card">
        <CardHeader dot="yellow" title="Ke mana uangmu pergi" />
        {cats.length === 0 ? (
          <EmptyState
            icon="expense"
            hint="Catat satu pengeluaran, rinciannya langsung muncul di sini."
            action={
              <button className="btn btn-primary" onClick={() => onRecord('pengeluaran')}>
                <Icon name="add" size={15} /> Catat Pengeluaran
              </button>
            }
          >
            Bulan ini masih kosong
          </EmptyState>
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
                  <div
                    className="progress-fill"
                    style={{ width: `${c.pct}%`, background: color }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="summary-grid">
        <div className="card">
          <CardHeader dot="green" title="Yang masuk" />
          <Row label="Gaji Pokok" value={t.salary} tone="gold" />
          <Row label="Penghasilan Tambahan" value={t.totalAdditional} tone="blue" />
          <Row label="Total" value={t.totalIncome} tone="green" bold />
        </div>
        <div className="card">
          <CardHeader dot="red" title="Yang keluar" />
          <Row label="Sudah Keluar" value={t.totalExpenses} tone="red" />
          <Row label="Rencana Keluar" value={t.totalPlanned} tone="yellow" />
          <Row label="Piutang Belum Lunas" value={t.totalPiutangBelumLunas} tone="purple" />
          {/* Angkanya identik dengan hero panel saldo (pemasukan − pengeluaran).
              Namanya disamakan supaya user tidak mengira ini angka lain. */}
          <Row
            label="Saldo Terkini"
            value={t.surplus}
            tone={t.surplus >= 0 ? 'green' : 'red'}
            signed
            bold
          />
        </div>
      </div>

      <TrendCard />

      <div className="card">
        <CardHeader dot="blue" title="Gaji dibagi ke mana" />
        {allocated.length === 0 ? (
          <EmptyState
            icon="account"
            hint="Bagi gaji ke rekening, biar saldo tiap akun kelihatan terpisah."
            action={
              <button className="btn btn-primary" onClick={() => onRecord('pemasukan')}>
                <Icon name="account" size={15} /> Atur Alokasi
              </button>
            }
          >
            Gaji belum dibagi ke rekening
          </EmptyState>
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

/**
 * Empat jalan pintas mencatat, langsung di beranda.
 *
 * Tombol ( + ) di nav bawah melakukan hal yang sama, tapi hanya ada di mobile —
 * dan di kunjungan pertama belum tentu ketemu. Di sini pilihannya kelihatan.
 */
const QUICK: { tab: TabName; icon: IconName; text: string; tone: string }[] = [
  { tab: 'pengeluaran', icon: 'expense', text: 'Pengeluaran', tone: 'tone-red' },
  { tab: 'pemasukan', icon: 'income', text: 'Pemasukan', tone: 'tone-green' },
  { tab: 'tunai', icon: 'cash', text: 'Tarik Tunai', tone: 'tone-yellow' },
  { tab: 'piutang', icon: 'piutang', text: 'Piutang', tone: 'tone-purple' },
];

function QuickActions({ onRecord }: { onRecord: (tab: TabName) => void }): ReactNode {
  return (
    <div className="quick-actions">
      {QUICK.map((q) => (
        <button key={q.tab} className="quick-action" onClick={() => onRecord(q.tab)}>
          <span className={'quick-action-icon ' + q.tone}>
            <Icon name={q.icon} size={20} />
          </span>
          <span className="quick-action-text">{q.text}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Tren pemasukan vs pengeluaran lintas bulan.
 *
 * Batang dibuat dari div berlebar persen, bukan SVG. Skalanya satu: semua
 * batang diukur terhadap nilai terbesar di seluruh rentang, supaya tinggi
 * batang antar bulan benar-benar bisa dibandingkan. Bar chart HTML juga ikut
 * responsif dan terbaca screen reader tanpa kerja tambahan — sesuatu yang harus
 * dibangun sendiri kalau pakai SVG.
 */
function TrendCard(): ReactNode {
  const { currentDate, data, changeMonth } = useApp();
  const activeKey = monthKey(currentDate);

  // `data` jadi dependency supaya rekap ikut segar setelah data bulan diubah.
  const points = useMemo(() => monthlyTrend(), [data]);

  if (points.length < 2) return null;

  const peak = Math.max(...points.map((p) => Math.max(p.income, p.expenses)));
  const avgNet = points.reduce((s, p) => s + p.net, 0) / points.length;

  return (
    <div className="card">
      <CardHeader
        dot="purple"
        title="Naik turun tiap bulan"
        action={
          <span className="cell-note">
            Rata-rata sisa <Money value={avgNet} tone={avgNet >= 0 ? 'green' : 'red'} signed />
          </span>
        }
      />
      <div className="card-note">
        Semua batang diukur ke bulan tertinggi, {fmtRp(peak)}. Ketuk salah satu untuk membukanya.
      </div>
      <div className="trend">
        {points.map((p) => (
          <button
            key={p.monthKey}
            className={'trend-row' + (p.monthKey === activeKey ? ' trend-row-active' : '')}
            onClick={() => changeMonth(monthsBetween(currentDate, p.monthDate))}
            title={`Buka ${p.shortLabel}`}
          >
            <span className="trend-label">{p.shortLabel}</span>
            <span className="trend-bars">
              <span className="trend-bar-track">
                <span
                  className="trend-bar trend-bar-in"
                  style={{ width: `${peak ? (p.income / peak) * 100 : 0}%` }}
                />
              </span>
              <span className="trend-bar-track">
                <span
                  className="trend-bar trend-bar-out"
                  style={{ width: `${peak ? (p.expenses / peak) * 100 : 0}%` }}
                />
              </span>
            </span>
            <span className="trend-figures">
              <Money value={p.income} tone="green" />
              <Money value={p.expenses} tone="red" negative />
              <Money value={p.net} tone={p.net >= 0 ? 'green' : 'red'} signed weight="strong" />
            </span>
          </button>
        ))}
      </div>
    </div>
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
