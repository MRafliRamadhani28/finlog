import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { useBalanceGuard } from '../hooks/useBalanceGuard';
import { sameAccount, visibleExpenses } from '../lib/calc';
import { catBadgeStyle, defaultDateFor, fmtDate } from '../lib/format';
import { nextId } from '../lib/id';
import { EXPENSE_CATS, type Expense } from '../types';
import {
  AccountSelect,
  CardHeader,
  CategorySelect,
  EmptyState,
  Field,
  FormRow,
  IconButton,
  Modal,
} from './Modal';
import { Icon } from './Icon';
import { Money } from './Money';

export function ExpenseTab(): ReactNode {
  const { data, accounts } = useApp();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  const visible = visibleExpenses(data);

  const handleDelete = async (e: Expense): Promise<void> => {
    // Expense turunan piutang/tunai hanya bisa dihapus dari tab asalnya.
    if (e.fromPiutang || e.fromCash) return;
    if (!(await confirmDelete())) return;
    undoable.month('Pengeluaran dihapus', (d) => {
      d.expenses = d.expenses.filter((x) => x.id !== e.id);
    });
  };

  return (
    <>
      <div className="card">
        <CardHeader
          dot="red"
          title="Pengeluaran Aktual"
          action={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Icon name="add" size={15} /> Tambah
            </button>
          }
        />
        {visible.length === 0 ? (
          <EmptyState icon="expense">Belum ada pengeluaran</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi</th>
                  <th>Jumlah</th>
                  <th>Akun</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...visible].reverse().map((e) => {
                  const acc = e.accountId ? accounts.find((a) => a.id === e.accountId) : null;
                  const locked = Boolean(e.fromPiutang || e.fromCash);
                  return (
                    <tr key={e.id}>
                      <td className="cell-muted">{fmtDate(e.date)}</td>
                      <td>
                        <span className="badge" style={catBadgeStyle(e.category)}>
                          {e.category}
                        </span>
                      </td>
                      <td className="cell-name">
                        {e.description}
                        {e.fromPlanned && <span className="badge badge-gray tag">rencana</span>}
                        {e.fromPiutang && <span className="badge badge-purple tag">piutang</span>}
                        {e.fromCash && <span className="badge badge-yellow tag">tunai</span>}
                      </td>
                      <td>
                        <Money value={e.amount} negative tone="red" weight="strong" />
                      </td>
                      <td>
                        {acc ? (
                          <span className="row row-tight">
                            <span className="acc-dot" style={{ background: acc.color }} />
                            <span className="cell-note">{acc.bank}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {locked ? (
                          <span className="cell-note">
                            {e.fromPiutang ? 'Via Piutang' : 'Via Tunai'}
                          </span>
                        ) : (
                          <div className="row row-tight">
                            <IconButton
                              icon="edit"
                              label="Edit pengeluaran"
                              onClick={() => {
                                setEditing(e);
                                setModalOpen(true);
                              }}
                            />
                            <IconButton
                              icon="delete"
                              tone="red"
                              label="Hapus pengeluaran"
                              onClick={() => void handleDelete(e)}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <ExpenseModal
          editing={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ExpenseModal({
  editing,
  onClose,
}: {
  editing: Expense | null;
  onClose: () => void;
}): ReactNode {
  const { updateMonth, accounts, currentDate } = useApp();
  const guard = useBalanceGuard();
  const [date, setDate] = useState(() => editing?.date || defaultDateFor(currentDate));
  const [category, setCategory] = useState<string>(editing?.category ?? EXPENSE_CATS[0]);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [accountId, setAccountId] = useState(editing?.accountId ? String(editing.accountId) : '');

  const submit = async (): Promise<void> => {
    const desc = description.trim();
    const amt = parseFloat(amount);
    if (!desc || !amt || amt <= 0) {
      toast.error('Lengkapi deskripsi dan jumlah!');
      return;
    }
    const accId = accountId ? parseInt(accountId, 10) : null;

    // Saat edit, yang dicek hanya tambahan biayanya (kalau akunnya sama).
    const cost = editing
      ? sameAccount(editing.accountId, accId)
        ? amt - editing.amount
        : amt
      : amt;
    if (!(await guard(accId, cost, { editing: Boolean(editing) }))) return;

    updateMonth((d) => {
      if (editing) {
        const item = d.expenses.find((x) => x.id === editing.id);
        if (!item) return;
        item.date = date;
        item.category = category;
        item.description = desc;
        item.amount = amt;
        item.note = note;
        item.accountId = accId;
      } else {
        d.expenses.push({
          id: nextId(d.expenses),
          date,
          category,
          description: desc,
          amount: amt,
          note,
          accountId: accId,
          fromPlanned: false,
        });
      }
    });
    toast.success(editing ? 'Pengeluaran diperbarui' : 'Pengeluaran ditambahkan');
    onClose();
  };

  return (
    <Modal
      open
      icon="expense"
      title={editing ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
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
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Kategori">
          <CategorySelect value={category} onChange={setCategory} options={EXPENSE_CATS} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Deskripsi" full>
          <input
            type="text"
            placeholder="Contoh: Makan siang"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Jumlah (Rp)">
          <input
            type="number"
            placeholder="50000"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Dari Akun">
          <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Catatan" full>
          <input
            type="text"
            placeholder="Opsional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </FormRow>
    </Modal>
  );
}
