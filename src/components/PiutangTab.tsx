import { useMemo, useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { useBalanceGuard } from '../hooks/useBalanceGuard';
import { isOverdue } from '../lib/calc';
import { monthsBetween, openPiutangElsewhere, type ForeignPiutang } from '../lib/crossMonth';
import { defaultDateFor, fmtDate, fmtMonthLabel, fmtRp } from '../lib/format';
import { monthKey } from '../lib/storage';
import {
  addPiutang,
  addPiutangSettlement,
  deletePiutang,
  markPiutangLunasKeepExpense,
  togglePiutangStatus,
} from '../lib/mutations';
import { AccountSelect, CardHeader, EmptyState, Field, FormRow, IconButton, Modal } from './Modal';
import { Icon } from './Icon';
import { Money } from './Money';
import { MoneyInput } from './MoneyInput';

export function PiutangTab(): ReactNode {
  const { data, updateMonth } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  const totalPt = data.piutang.reduce((s, p) => s + p.amount, 0);
  const totalLunas = data.piutang
    .filter((p) => p.status === 'Lunas')
    .reduce((s, p) => s + p.amount, 0);

  const remove = async (id: number): Promise<void> => {
    if (!(await confirmDelete('Piutang ini beserta entry pengeluarannya akan dihapus.'))) return;
    undoable.month('Piutang dihapus', (d) => deletePiutang(d, id));
  };

  const toggle = (id: number): void => {
    const pt = data.piutang.find((p) => p.id === id);
    updateMonth((d) => togglePiutangStatus(d, id));
    toast.success(
      pt?.status === 'Belum Lunas' ? 'Ditandai lunas — saldo pulih' : 'Ditandai belum lunas',
    );
  };

  const stats: { label: string; value: number; tone: 'purple' | 'green' | 'red' }[] = [
    { label: 'Total', value: totalPt, tone: 'purple' },
    { label: 'Lunas', value: totalLunas, tone: 'green' },
    { label: 'Belum Lunas', value: totalPt - totalLunas, tone: 'red' },
  ];

  return (
    <>
      <div className="card">
        <CardHeader
          dot="purple"
          title="Piutang (Uang Dipinjamkan)"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
              <Icon name="add" size={15} /> Tambah
            </button>
          }
        />
        <div className="card-note">
          Saldo <b className="text-red">berkurang</b> saat dicatat, dan{' '}
          <b className="text-green">pulih</b> saat ditandai Lunas.
        </div>
        {data.piutang.length === 0 ? (
          <EmptyState
            icon="piutang"
            hint="Catat uang yang dipinjam orang lain lengkap dengan jatuh temponya, supaya tidak lupa ditagih."
            action={
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                <Icon name="add" size={15} /> Tambah Piutang
              </button>
            }
          >
            Belum ada catatan piutang
          </EmptyState>
        ) : (
          <>
            <div className="stat-tiles">
              {stats.map((s) => (
                <div key={s.label} className="stat-tile">
                  <div className="stat-tile-label">{s.label}</div>
                  <Money value={s.value} tone={s.tone} weight="strong" />
                </div>
              ))}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Tgl Pinjam</th>
                    <th>Jumlah</th>
                    <th>Jatuh Tempo</th>
                    <th>Status</th>
                    <th>Catatan</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...data.piutang].reverse().map((p) => {
                    const overdue = isOverdue(p);
                    return (
                      <tr key={p.id}>
                        <td className="cell-name">{p.name}</td>
                        <td className="cell-muted">{fmtDate(p.date)}</td>
                        <td>
                          <Money value={p.amount} tone="purple" weight="strong" />
                        </td>
                        <td className={overdue ? 'text-red' : 'cell-muted'}>
                          {fmtDate(p.due)}
                          {overdue && (
                            <>
                              {' '}
                              <Icon name="warn" size={12} />
                            </>
                          )}
                        </td>
                        <td>
                          <button
                            className={
                              'badge status-toggle ' +
                              (p.status === 'Lunas' ? 'badge-green' : 'badge-red')
                            }
                            onClick={() => toggle(p.id)}
                            aria-label={`Ubah status ${p.name}`}
                          >
                            {p.status} <Icon name="swap" size={11} />
                          </button>
                        </td>
                        <td className="cell-note">{p.note || '-'}</td>
                        <td>
                          <IconButton
                            icon="delete"
                            tone="red"
                            label="Hapus piutang"
                            onClick={() => void remove(p.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ForeignPiutangCard />

      {modalOpen && <PiutangModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

/**
 * Piutang belum lunas dari bulan lain.
 *
 * Sengaja tidak ikut menghitung ulang saldo bulan ini: uangnya sudah keluar di
 * bulan tempat piutang itu dicatat. Menambahkannya begitu saja akan
 * menghitungnya dua kali — user yang memilih ke mana uang kembalinya masuk,
 * lewat `SettleChoiceModal`.
 */
function ForeignPiutangCard(): ReactNode {
  const { currentDate, data, updateMonth, updateMonthAt, reloadAll, changeMonth } = useApp();
  const [settling, setSettling] = useState<ForeignPiutang | null>(null);
  const key = monthKey(currentDate);

  // `data` ikut jadi dependency: `reloadAll()` mengganti identitasnya, dan itu
  // sinyal bahwa piutang di bulan lain baru saja diubah dari sini.
  const foreign = useMemo(() => openPiutangElsewhere(key), [key, data]);

  if (foreign.length === 0) return null;

  const total = foreign.reduce((s, f) => s + f.piutang.amount, 0);

  /** Uang kembali dicatat sebagai pemasukan bulan ini; bulan asal tetap keluar. */
  const settleHere = (f: ForeignPiutang): void => {
    updateMonthAt(f.monthKey, (d) => markPiutangLunasKeepExpense(d, f.piutang.id));
    updateMonth((d) =>
      addPiutangSettlement(
        d,
        { name: f.piutang.name, amount: f.piutang.amount, fromMonthLabel: f.monthLabel },
        defaultDateFor(currentDate),
      ),
    );
    reloadAll();
    setSettling(null);
    toast.success(`Pelunasan ${f.piutang.name} masuk sebagai pemasukan bulan ini`);
  };

  /** Perilaku asal: expense di bulan asalnya dihapus, saldo bulan itu pulih. */
  const settleAtOrigin = (f: ForeignPiutang): void => {
    updateMonthAt(f.monthKey, (d) => togglePiutangStatus(d, f.piutang.id));
    reloadAll();
    setSettling(null);
    toast.success(`Saldo ${f.monthLabel} dipulihkan`);
  };

  return (
    <>
      <div className="card">
        <CardHeader
          dot="red"
          title="Belum Lunas dari Bulan Lain"
          action={<Money value={total} tone="red" weight="strong" />}
        />
        <div className="card-note">
          Uangnya keluar di bulan asalnya, jadi tidak dihitung ulang di saldo bulan ini. Saat
          ditandai lunas, kamu memilih ke bulan mana uang kembalinya dicatat.
        </div>
        {foreign.map((f) => {
          const overdue = isOverdue(f.piutang);
          return (
            <div key={f.monthKey + ':' + f.piutang.id} className="foreign-piutang">
              <div className="foreign-piutang-main">
                <span className="cell-name">{f.piutang.name}</span>
                <Money value={f.piutang.amount} tone="purple" weight="strong" />
              </div>
              <div className="foreign-piutang-meta">
                <button
                  className="badge badge-gray link-badge"
                  onClick={() => changeMonth(monthsBetween(currentDate, f.monthDate))}
                  title={`Buka ${f.monthLabel}`}
                >
                  <Icon name="prev" size={11} /> {f.monthLabel}
                </button>
                {f.piutang.due && (
                  <span className={overdue ? 'text-red' : 'cell-muted'}>
                    Jatuh tempo {fmtDate(f.piutang.due)}
                    {overdue && (
                      <>
                        {' '}
                        <Icon name="warn" size={12} />
                      </>
                    )}
                  </span>
                )}
                {f.piutang.note && <span className="cell-note">{f.piutang.note}</span>}
              </div>
              <button className="btn btn-green btn-sm" onClick={() => setSettling(f)}>
                <Icon name="check" size={15} /> Tandai Lunas
              </button>
            </div>
          );
        })}
      </div>

      {settling && (
        <SettleChoiceModal
          item={settling}
          onClose={() => setSettling(null)}
          onSettleHere={() => settleHere(settling)}
          onSettleAtOrigin={() => settleAtOrigin(settling)}
        />
      )}
    </>
  );
}

/**
 * Pilihan ke bulan mana uang piutang yang kembali dicatat.
 *
 * Pertanyaan ini hanya muncul untuk piutang bulan lain. Kalau piutang dilunasi
 * di bulan yang sama dengan pencatatannya, tidak ada yang ambigu: expense-nya
 * dihapus dan saldo bulan itu langsung pulih.
 *
 * Tidak memakai `useConfirm()` karena dialog itu boolean — menutup lewat Escape
 * akan terbaca sebagai memilih salah satu opsi, dan ini keputusan soal uang.
 */
function SettleChoiceModal({
  item,
  onClose,
  onSettleHere,
  onSettleAtOrigin,
}: {
  item: ForeignPiutang;
  onClose: () => void;
  onSettleHere: () => void;
  onSettleAtOrigin: () => void;
}): ReactNode {
  const { currentDate } = useApp();
  const thisMonth = fmtMonthLabel(currentDate);

  return (
    <Modal
      open
      icon="piutang"
      title={`${item.piutang.name} melunasi ${fmtRp(item.piutang.amount)}`}
      onClose={onClose}
      maxWidth={480}
      actions={
        <button className="btn btn-ghost" onClick={onClose}>
          Batal
        </button>
      }
    >
      <p className="modal-text">
        Piutang ini dicatat di <b>{item.monthLabel}</b>. Uang kembalinya mau masuk ke bulan mana?
      </p>
      <button className="settle-option" onClick={onSettleHere}>
        <span className="settle-option-title">
          <Icon name="income" size={15} /> Masuk {thisMonth}
        </span>
        <span className="settle-option-desc">
          Dicatat sebagai pemasukan bulan ini. {item.monthLabel} tetap mencatat uangnya keluar —
          riwayat kedua bulan sesuai kejadian sebenarnya.
        </span>
      </button>
      <button className="settle-option" onClick={onSettleAtOrigin}>
        <span className="settle-option-title">
          <Icon name="refresh" size={15} /> Pulihkan di {item.monthLabel}
        </span>
        <span className="settle-option-desc">
          Pengeluaran piutang di bulan itu dihapus, seolah uangnya tidak pernah keluar. Saldo bulan
          ini tidak berubah.
        </span>
      </button>
    </Modal>
  );
}

function PiutangModal({ onClose }: { onClose: () => void }): ReactNode {
  const { updateMonth, accounts, currentDate } = useApp();
  const guard = useBalanceGuard();
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => defaultDateFor(currentDate));
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');

  const submit = async (): Promise<void> => {
    const nm = name.trim();
    const amt = parseFloat(amount);
    if (!nm || !amt || amt <= 0) {
      toast.error('Lengkapi nama dan jumlah!');
      return;
    }
    const accId = accountId ? parseInt(accountId, 10) : null;
    if (!(await guard(accId, amt))) return;

    updateMonth((d) => addPiutang(d, { name: nm, date, amount: amt, due, note, accountId: accId }));
    toast.success('Piutang dicatat');
    onClose();
  };

  return (
    <Modal
      open
      icon="piutang"
      title="Tambah Piutang"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={() => void submit()}>
            Simpan
          </button>
        </>
      }
    >
      <FormRow>
        <Field label="Nama Peminjam">
          <input
            type="text"
            placeholder="Nama orang"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Jumlah (Rp)">
          <MoneyInput placeholder="500.000" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Jatuh Tempo">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Dari Akun">
          <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} />
        </Field>
        <Field label="Catatan">
          <input
            type="text"
            placeholder="Keperluan pinjaman"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </FormRow>
    </Modal>
  );
}
