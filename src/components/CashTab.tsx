import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { useBalanceGuard } from '../hooks/useBalanceGuard';
import { catBadgeStyle, defaultDateFor, fmtDate, fmtRp } from '../lib/format';
import { nextId } from '../lib/id';
import { addCashWithdrawal, deleteCashWithdrawal } from '../lib/mutations';
import { EXPENSE_CATS } from '../types';
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
import { MoneyInput } from './MoneyInput';

export function CashTab({ openAddSignal }: { openAddSignal?: number } = {}): ReactNode {
  const { data, accounts } = useApp();
  const [cashModal, setCashModal] = useState(false);
  const [itemModalFor, setItemModalFor] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (openAddSignal === undefined) return;
    setCashModal(true);
  }, [openAddSignal]);

  const toggleExpand = (id: number): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeWithdrawal = async (id: number): Promise<void> => {
    if (!(await confirmDelete('Penarikan ini beserta entry pengeluarannya akan dihapus.'))) return;
    undoable.month('Penarikan tunai dihapus', (d) => deleteCashWithdrawal(d, id));
  };

  const removeItem = async (cashId: number, itemId: number): Promise<void> => {
    if (!(await confirmDelete())) return;
    undoable.month('Detail dihapus', (d) => {
      const cash = d.cashWithdrawals.find((c) => c.id === cashId);
      if (cash) cash.items = cash.items.filter((i) => i.id !== itemId);
    });
  };

  return (
    <>
      <div className="card">
        <CardHeader
          dot="yellow"
          title="Penarikan Tunai"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setCashModal(true)}>
              <Icon name="add" size={15} /> Tarik Tunai
            </button>
          }
        />
        <div className="card-note">Buka satu penarikan untuk merinci pemakaian tunainya.</div>
        {data.cashWithdrawals.length === 0 ? (
          <EmptyState
            icon="cash"
            hint="Uang di dompet paling gampang hilang jejak. Catat tarikannya di sini."
            action={
              <button className="btn btn-primary" onClick={() => setCashModal(true)}>
                <Icon name="add" size={15} /> Tarik Tunai
              </button>
            }
          >
            Belum ada penarikan tunai
          </EmptyState>
        ) : (
          [...data.cashWithdrawals].reverse().map((c) => {
            const acc = c.accountId ? accounts.find((a) => a.id === c.accountId) : null;
            const tracked = c.items.reduce((s, i) => s + i.amount, 0);
            const untracked = c.amount - tracked;
            const isOpen = expanded.has(c.id);
            return (
              <div key={c.id} className={'cash-item' + (isOpen ? ' cash-expanded' : '')}>
                <div
                  className="cash-header"
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => toggleExpand(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(c.id);
                    }
                  }}
                >
                  <span className="cash-expand-icon">
                    <Icon name="next" size={14} />
                  </span>
                  <span className="cash-main">
                    <span className="cash-desc">{c.description}</span>
                    <span className="cash-meta">
                      <span>{fmtDate(c.date)}</span>
                      {acc ? (
                        <span className="row row-tight">
                          <span className="acc-dot acc-dot-md" style={{ background: acc.color }} />
                          {acc.bank} · {acc.name}
                        </span>
                      ) : (
                        <span>Tunai</span>
                      )}
                      <span>
                        {c.items.length} rincian
                      </span>
                      {untracked > 0 && (
                        <span className="cash-meta-warn">
                          <Icon name="warn" size={11} /> Sisa {fmtRp(untracked)} belum dirinci
                        </span>
                      )}
                    </span>
                  </span>
                  <Money value={c.amount} tone="yellow" weight="bold" className="cash-amount" />
                  <IconButton
                    icon="delete"
                    tone="red"
                    label="Hapus penarikan tunai"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeWithdrawal(c.id);
                    }}
                  />
                </div>
                <div className="cash-body">
                  <div className="cash-sub-items">
                    {c.items.length === 0 ? (
                      <p className="card-note mb-0">Belum ada detail penggunaan tunai.</p>
                    ) : (
                      c.items.map((item) => (
                        <div key={item.id} className="cash-sub-item">
                          <span className="badge" style={catBadgeStyle(item.category)}>
                            {item.category}
                          </span>
                          <span className="cell-name">{item.description}</span>
                          <span className="sub-amount">
                            <Money value={item.amount} negative />
                          </span>
                          <IconButton
                            icon="delete"
                            tone="red"
                            label="Hapus detail"
                            onClick={() => void removeItem(c.id, item.id)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                  <div
                    className={'cash-untracked ' + (untracked > 0 ? 'tone-yellow' : 'tone-green')}
                  >
                    <span>Sudah tercatat</span>
                    <Money value={tracked} weight="strong" />
                  </div>
                  {untracked > 0 && (
                    <div className="cash-untracked tone-red mt-1">
                      <span>Belum tercatat</span>
                      <Money value={untracked} weight="strong" />
                    </div>
                  )}
                  <button
                    className="btn btn-primary btn-sm mt-3"
                    onClick={() => setItemModalFor(c.id)}
                  >
                    <Icon name="add" size={15} /> Tambah Detail
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {cashModal && <CashModal onClose={() => setCashModal(false)} />}
      {itemModalFor !== null && (
        <CashItemModal cashId={itemModalFor} onClose={() => setItemModalFor(null)} />
      )}
    </>
  );
}

function CashModal({ onClose }: { onClose: () => void }): ReactNode {
  const { updateMonth, accounts, currentDate } = useApp();
  const guard = useBalanceGuard();
  const [date, setDate] = useState(() => defaultDateFor(currentDate));
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const submit = async (): Promise<void> => {
    const amt = parseFloat(amount);
    const desc = description.trim() || 'Penarikan Tunai';
    if (!amt || amt <= 0) {
      toast.error('Isi jumlah penarikan');
      return;
    }
    const accId = accountId ? parseInt(accountId, 10) : null;
    if (!(await guard(accId, amt))) return;

    updateMonth((d) =>
      addCashWithdrawal(d, { date, accountId: accId, amount: amt, description: desc }, accounts),
    );
    toast.success('Penarikan tunai tersimpan');
    onClose();
  };

  return (
    <Modal
      open
      icon="cash"
      title="Penarikan Tunai"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={() => void submit()}>
            Catat Penarikan
          </button>
        </>
      }
    >
      <FormRow>
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Dari Akun">
          <AccountSelect
            value={accountId}
            onChange={setAccountId}
            accounts={accounts}
            placeholder="— Pilih Akun —"
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Jumlah Tarik (Rp)">
          <MoneyInput placeholder="500.000" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Deskripsi">
          <input
            type="text"
            placeholder="Contoh: Keperluan mingguan"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FormRow>
    </Modal>
  );
}

function CashItemModal({ cashId, onClose }: { cashId: number; onClose: () => void }): ReactNode {
  const { updateMonth } = useApp();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(EXPENSE_CATS[0]);
  const [amount, setAmount] = useState('');

  const submit = (): void => {
    const desc = description.trim();
    const amt = parseFloat(amount);
    if (!desc || !amt || amt <= 0) {
      toast.error('Lengkapi deskripsi dan jumlah');
      return;
    }
    let found = true;
    updateMonth((d) => {
      const cash = d.cashWithdrawals.find((c) => c.id === cashId);
      if (!cash) {
        found = false;
        return;
      }
      cash.items.push({ id: nextId(cash.items), description: desc, category, amount: amt });
    });
    if (!found) {
      toast.error('Data tidak ditemukan');
      return;
    }
    toast.success('Detail tersimpan');
    onClose();
  };

  return (
    <Modal
      open
      icon="expense"
      title="Detail Tunai"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Simpan Detail
          </button>
        </>
      }
    >
      <FormRow>
        <Field label="Digunakan untuk" full>
          <input
            type="text"
            placeholder="Contoh: Makan siang warung"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Kategori">
          <CategorySelect value={category} onChange={setCategory} options={EXPENSE_CATS} />
        </Field>
        <Field label="Jumlah (Rp)">
          <MoneyInput placeholder="50.000" value={amount} onChange={setAmount} />
        </Field>
      </FormRow>
    </Modal>
  );
}
