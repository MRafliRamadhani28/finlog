import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { getAccountBalance } from '../lib/calc';
import { nextId } from '../lib/id';
import { ACCOUNT_COLORS } from '../lib/constants';
import type { Account } from '../types';
import { CardHeader, EmptyState, Field, FormRow, IconButton, Modal } from './Modal';
import { Icon } from './Icon';
import { Money } from './Money';

export function AccountTab(): ReactNode {
  const { data, accounts } = useApp();
  const [editing, setEditing] = useState<Account | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  const remove = async (id: number): Promise<void> => {
    if (!(await confirmDelete('Akun bank ini akan dihapus.'))) return;
    undoable.accounts('Akun dihapus', (list) => {
      const idx = list.findIndex((a) => a.id === id);
      if (idx > -1) list.splice(idx, 1);
    });
  };

  return (
    <>
      <div className="card">
        <CardHeader
          dot="blue"
          title="Akun Bank"
          action={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Icon name="add" size={15} /> Tambah Akun
            </button>
          }
        />
        {accounts.length === 0 ? (
          <EmptyState icon="account">
            Tambahkan akun bank untuk mengatur alokasi gaji dan melacak saldo per rekening.
          </EmptyState>
        ) : (
          <div className="account-grid">
            {accounts.map((a) => {
              const b = getAccountBalance(a.id, data);
              const hasAlloc = b.allocAmt > 0;
              return (
                <div
                  key={a.id}
                  className="account-card"
                  style={{ '--acc': a.color } as React.CSSProperties}
                >
                  <div className="account-bank" style={{ color: a.color }}>
                    {a.bank}
                  </div>
                  <div className="account-name">{a.name}</div>
                  {a.number && <div className="account-num">{a.number}</div>}
                  {hasAlloc ? (
                    <div className="account-card-body">
                      <div className="acc-bal-row">
                        <span className="cell-muted">Alokasi Gaji</span>
                        <span className="num num-strong" style={{ color: a.color }}>
                          <Money value={b.allocAmt} weight="strong" />
                        </span>
                      </div>
                      {b.cashOut > 0 && (
                        <div className="acc-bal-row">
                          <span className="cell-muted">Tarik Tunai</span>
                          <Money value={b.cashOut} negative tone="yellow" />
                        </div>
                      )}
                      {b.expOut > 0 && (
                        <div className="acc-bal-row">
                          <span className="cell-muted">Pengeluaran</span>
                          <Money value={b.expOut} negative tone="red" />
                        </div>
                      )}
                      <div className="acc-bal-row account-card-total">
                        <span className="account-total-label">Saldo Efektif</span>
                        <Money
                          value={b.effective}
                          signed
                          weight="bold"
                          tone={b.effective >= 0 ? 'green' : 'red'}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="account-empty-note">Belum ada alokasi gaji bulan ini</div>
                  )}
                  <div className="account-actions mt-3">
                    <IconButton
                      icon="edit"
                      label={`Edit akun ${a.name}`}
                      onClick={() => {
                        setEditing(a);
                        setModalOpen(true);
                      }}
                    />
                    <IconButton
                      icon="delete"
                      tone="red"
                      label={`Hapus akun ${a.name}`}
                      onClick={() => void remove(a.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <AccountModal
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

function AccountModal({
  editing,
  onClose,
}: {
  editing: Account | null;
  onClose: () => void;
}): ReactNode {
  const { updateAccounts } = useApp();
  const [name, setName] = useState(editing?.name ?? '');
  const [bank, setBank] = useState(editing?.bank ?? '');
  const [number, setNumber] = useState(editing?.number ?? '');
  const [color, setColor] = useState<string>(editing?.color ?? ACCOUNT_COLORS[0].value);

  const submit = (): void => {
    const nm = name.trim();
    const bk = bank.trim();
    if (!nm || !bk) {
      toast.error('Isi nama akun dan bank!');
      return;
    }
    updateAccounts((list) => {
      if (editing) {
        const acc = list.find((a) => a.id === editing.id);
        if (acc) {
          acc.name = nm;
          acc.bank = bk;
          acc.number = number.trim();
          acc.color = color;
        }
      } else {
        list.push({ id: nextId(list), name: nm, bank: bk, number: number.trim(), color });
      }
    });
    toast.success(editing ? 'Akun diperbarui' : 'Akun ditambahkan');
    onClose();
  };

  return (
    <Modal
      open
      icon="account"
      title={editing ? 'Edit Akun Bank' : 'Tambah Akun Bank'}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Simpan
          </button>
        </>
      }
    >
      <FormRow>
        <Field label="Nama Akun">
          <input
            type="text"
            placeholder="Contoh: Tabungan Utama"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Nama Bank">
          <input
            type="text"
            placeholder="Contoh: BCA, BRI, Mandiri"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="No. Rekening (opsional)">
          <input
            type="text"
            placeholder="xxxx-xxxx-xxxx"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </Field>
        <Field label="Warna Penanda">
          <div className="color-picker">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={'color-swatch' + (color === c.value ? ' selected' : '')}
                style={{ background: c.value }}
                aria-label={c.label}
                aria-pressed={color === c.value}
                title={c.label}
                onClick={() => setColor(c.value)}
              />
            ))}
          </div>
        </Field>
      </FormRow>
    </Modal>
  );
}
