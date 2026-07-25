import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { useBalanceGuard } from '../hooks/useBalanceGuard';
import { isOverdue } from '../lib/calc';
import { defaultDateFor, fmtDate } from '../lib/format';
import { addPiutang, deletePiutang, togglePiutangStatus } from '../lib/mutations';
import {
  AccountSelect,
  CardHeader,
  EmptyState,
  Field,
  FormRow,
  IconButton,
  Modal,
} from './Modal';
import { Icon } from './Icon';
import { Money } from './Money';

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
          <EmptyState icon="piutang">Belum ada catatan piutang</EmptyState>
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

      {modalOpen && <PiutangModal onClose={() => setModalOpen(false)} />}
    </>
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
          <input
            type="number"
            placeholder="500000"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
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
