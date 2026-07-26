import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { useBalanceGuard } from '../hooks/useBalanceGuard';
import { getAccountBalance } from '../lib/calc';
import { defaultDateFor, fmtRp } from '../lib/format';
import { nextId } from '../lib/id';
import { checkPlanned, uncheckPlanned } from '../lib/mutations';
import { EXPENSE_CATS, type Planned } from '../types';
import { CardHeader, CategorySelect, EmptyState, Field, FormRow, IconButton, Modal } from './Modal';
import { Icon } from './Icon';
import { Money } from './Money';
import { MoneyInput } from './MoneyInput';

export function PlannedTab(): ReactNode {
  const { data, updateMonth, accounts, currentDate } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Planned | null>(null);
  const [chooserFor, setChooserFor] = useState<Planned | null>(null);
  const guard = useBalanceGuard();
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  /** Cek saldo akun sebelum rencana dijadikan pengeluaran aktual. */
  const process = async (item: Planned, accountId: number | null): Promise<void> => {
    if (!(await guard(accountId, item.amount))) return;
    updateMonth((d) => checkPlanned(d, item.id, accountId, defaultDateFor(currentDate)));
    toast.success('Rencana jadi pengeluaran');
  };

  const toggle = async (item: Planned): Promise<void> => {
    if (item.checked) {
      updateMonth((d) => uncheckPlanned(d, item.id));
      toast.success('Dikembalikan ke rencana');
      return;
    }
    // >1 akun: user pilih dulu akunnya. 0/1 akun: langsung proses.
    if (accounts.length > 1) {
      setChooserFor(item);
      return;
    }
    await process(item, accounts.length === 1 ? (accounts[0]?.id ?? null) : null);
  };

  const remove = async (id: number): Promise<void> => {
    if (!(await confirmDelete())) return;
    undoable.month('Rencana dihapus', (d) => {
      d.planned = d.planned.filter((p) => p.id !== id);
    });
  };

  const sorted = [
    ...data.planned.filter((p) => !p.checked),
    ...data.planned.filter((p) => p.checked),
  ];

  return (
    <>
      <div className="card">
        <CardHeader
          dot="yellow"
          title="Rencana"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <Icon name="add" size={15} /> Tambah
            </button>
          }
        />
        <div className="card-note">Centang item untuk memindahkan ke pengeluaran aktual.</div>
        {sorted.length === 0 ? (
          <EmptyState
            icon="planned"
            hint="Daftarkan yang akan dibeli supaya uangnya sudah punya tujuan."
            action={
              <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                <Icon name="add" size={15} /> Tambah Rencana
              </button>
            }
          >
            Belum ada rencana
          </EmptyState>
        ) : (
          sorted.map((p) => (
            <div key={p.id} className={'planned-item' + (p.checked ? ' checked' : '')}>
              <button
                className={'checkbox' + (p.checked ? ' checked' : '')}
                role="checkbox"
                aria-checked={p.checked}
                aria-label={`Tandai ${p.description} sudah dibayar`}
                onClick={() => void toggle(p)}
              >
                {p.checked && (
                  <svg viewBox="0 0 12 12">
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                )}
              </button>
              <div className="planned-info">
                <div className={'planned-name' + (p.checked ? ' struck' : '')}>{p.description}</div>
                <div className="planned-cat">
                  {p.category}
                  {p.checked && ' • Sudah dibayar'}
                </div>
              </div>
              <div className="planned-amount">
                <Money value={p.amount} negative tone={p.checked ? 'plain' : 'red'} />
              </div>
              {p.checked ? (
                <span className="planned-lock" title="Terkunci — batalkan centang untuk mengubah">
                  <Icon name="lock" size={15} />
                </span>
              ) : (
                <>
                  <IconButton icon="edit" label="Edit rencana" onClick={() => setEditing(p)} />
                  <IconButton
                    icon="delete"
                    tone="red"
                    label="Hapus rencana"
                    onClick={() => void remove(p.id)}
                  />
                </>
              )}
            </div>
          ))
        )}
      </div>

      {addOpen && <PlannedModal onClose={() => setAddOpen(false)} />}
      {editing && <PlannedModal editing={editing} onClose={() => setEditing(null)} />}
      {chooserFor && (
        <AccountChooser
          item={chooserFor}
          onClose={() => setChooserFor(null)}
          onPick={(accountId) => {
            const item = chooserFor;
            setChooserFor(null);
            void process(item, accountId);
          }}
        />
      )}
    </>
  );
}

function PlannedModal({ editing, onClose }: { editing?: Planned; onClose: () => void }): ReactNode {
  const { updateMonth } = useApp();
  const [description, setDescription] = useState(editing?.description ?? '');
  const [category, setCategory] = useState<string>(editing?.category ?? EXPENSE_CATS[0]);
  const [amount, setAmount] = useState(editing ? String(Math.round(editing.amount)) : '');

  const submit = (): void => {
    const desc = description.trim();
    const amt = parseFloat(amount);
    if (!desc || !amt || amt <= 0) {
      toast.error('Lengkapi deskripsi dan jumlah');
      return;
    }
    updateMonth((d) => {
      if (editing) {
        const item = d.planned.find((p) => p.id === editing.id);
        if (!item) return;
        item.description = desc;
        item.category = category;
        item.amount = amt;
      } else {
        d.planned.push({
          id: nextId(d.planned),
          category,
          description: desc,
          amount: amt,
          checked: false,
        });
      }
    });
    toast.success(editing ? 'Rencana diperbarui' : 'Rencana tersimpan');
    onClose();
  };

  return (
    <Modal
      open
      icon="planned"
      title={editing ? 'Edit Rencana' : 'Rencana Baru'}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Simpan Rencana
          </button>
        </>
      }
    >
      <FormRow>
        <Field label="Deskripsi" full>
          <input
            type="text"
            placeholder="Contoh: Bayar listrik"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Kategori">
          <CategorySelect value={category} onChange={setCategory} options={EXPENSE_CATS} />
        </Field>
        <Field label="Estimasi (Rp)">
          <MoneyInput placeholder="100.000" value={amount} onChange={setAmount} />
        </Field>
      </FormRow>
    </Modal>
  );
}

function AccountChooser({
  item,
  onClose,
  onPick,
}: {
  item: Planned;
  onClose: () => void;
  onPick: (accountId: number | null) => void;
}): ReactNode {
  const { data, accounts } = useApp();
  return (
    <Modal open icon="account" title="Pilih Akun Bank" onClose={onClose} maxWidth={420}>
      <p className="modal-text">
        <b>{item.description}</b> — {fmtRp(item.amount)}
        <br />
        Pilih akun untuk pengeluaran ini:
      </p>
      <div className="acc-choose-list">
        {accounts.map((a) => {
          const bal = getAccountBalance(a.id, data);
          return (
            <button key={a.id} className="acc-choose-btn" onClick={() => onPick(a.id)}>
              <div className="acc-choose-dot" style={{ background: a.color }} />
              <div className="acc-choose-info">
                <div className="acc-choose-name">{a.name}</div>
                <div className="acc-choose-sub">{a.bank}</div>
              </div>
              <div className="acc-choose-bal">
                <Money value={bal.effective} signed tone={bal.effective < 0 ? 'red' : 'green'} />
              </div>
            </button>
          );
        })}
        <button className="acc-choose-skip" onClick={() => onPick(null)}>
          Tanpa akun bank
        </button>
      </div>
    </Modal>
  );
}
