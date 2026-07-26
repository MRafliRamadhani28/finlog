import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { cleanIncome, filterEntries, totalAllocated } from '../lib/calc';
import { catBadgeStyle, defaultDateFor, fmtDate, fmtRp } from '../lib/format';
import { deleteIncome, setAllocation } from '../lib/mutations';
import { nextId } from '../lib/id';
import { INCOME_CATS } from '../types';
import {
  CardHeader,
  CategorySelect,
  EmptyState,
  Field,
  FilterBar,
  FormRow,
  IconButton,
  Modal,
  NoMatch,
} from './Modal';
import { Icon } from './Icon';
import { Money } from './Money';
import { MoneyInput } from './MoneyInput';

export function IncomeTab({ openAddSignal }: { openAddSignal?: number } = {}): ReactNode {
  const { data, updateMonth, accounts } = useApp();
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (openAddSignal === undefined) return;
    setModalOpen(true);
  }, [openAddSignal]);

  const income = cleanIncome(data.income);
  const rows = filterEntries(income, query, catFilter);

  const resetFilter = (): void => {
    setQuery('');
    setCatFilter('');
  };

  const openSalaryEdit = (): void => {
    if (editingSalary) {
      setEditingSalary(false);
      return;
    }
    setSalaryInput(data.salary ? String(Math.round(data.salary)) : '');
    setEditingSalary(true);
  };

  const saveSalary = (): void => {
    const val = parseFloat(salaryInput) || 0;
    updateMonth((d) => {
      d.salary = val;
    });
    setEditingSalary(false);
    toast.success('Gaji disimpan');
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!(await confirmDelete())) return;
    undoable.month('Pemasukan dihapus', (d) => deleteIncome(d, id));
  };

  return (
    <>
      <div className="card">
        <CardHeader
          dot="yellow"
          title="Gaji Bulanan"
          action={
            <button className="btn btn-ghost btn-sm" onClick={openSalaryEdit}>
              <Icon name={editingSalary ? 'close' : 'edit'} size={15} />
              {editingSalary ? 'Tutup' : 'Edit'}
            </button>
          }
        />
        <div className="salary-section">
          <div className="salary-display">
            <div className="salary-big">
              <Money value={data.salary || 0} weight="bold" />
            </div>
            <div className="card-note mb-0">Gaji pokok bulan ini</div>
          </div>
          {editingSalary && (
            <div className="salary-edit">
              <div className="form-group grow">
                <label htmlFor="salary-input">Nominal Gaji</label>
                <MoneyInput
                  id="salary-input"
                  placeholder="5.000.000"
                  autoFocus
                  value={salaryInput}
                  onChange={setSalaryInput}
                  onKeyDown={(e) => e.key === 'Enter' && saveSalary()}
                />
              </div>
              <button className="btn btn-green" onClick={saveSalary}>
                Simpan
              </button>
            </div>
          )}
        </div>
        {accounts.length > 0 && data.salary > 0 && <SalarySplit />}
      </div>

      <div className="card">
        <CardHeader
          dot="blue"
          title="Penghasilan Tambahan"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
              <Icon name="add" size={15} /> Tambah
            </button>
          }
        />
        {income.length === 0 ? (
          <EmptyState
            icon="income"
            hint="Catat gaji, bonus, atau uang masuk lain supaya saldo ikut terhitung."
            action={
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                <Icon name="add" size={15} /> Tambah Penghasilan
              </button>
            }
          >
            Belum ada penghasilan tambahan
          </EmptyState>
        ) : (
          <>
            <FilterBar
              query={query}
              onQuery={setQuery}
              category={catFilter}
              onCategory={setCatFilter}
              categories={INCOME_CATS}
              shown={rows.length}
              total={income.length}
            />
            {rows.length === 0 ? (
              <NoMatch onReset={resetFilter} />
            ) : (
              <>
                <div className="entry-cards">
                  {[...rows].reverse().map((i) => (
                    <div className="entry-card" key={i.id}>
                      <span className="entry-tile" style={catBadgeStyle(i.category)}>
                        <Icon name="income" size={18} />
                      </span>
                      <div className="entry-card-body">
                        <div className="entry-card-desc">{i.description}</div>
                        <div className="entry-card-meta">
                          <span>
                            {i.category} · {fmtDate(i.date)}
                          </span>
                          {i.note && <span>· {i.note}</span>}
                        </div>
                      </div>
                      <div className="entry-card-amount">
                        <Money value={i.amount} tone="green" weight="strong" />
                      </div>
                      <div className="entry-card-actions">
                        <IconButton
                          icon="delete"
                          tone="red"
                          label={`Hapus pemasukan ${i.description}`}
                          onClick={() => void handleDelete(i.id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kategori</th>
                      <th>Deskripsi</th>
                      <th>Jumlah</th>
                      <th>Catatan</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((i) => (
                      <tr key={i.id}>
                        <td className="cell-muted">{fmtDate(i.date)}</td>
                        <td>
                          <span className="badge" style={catBadgeStyle(i.category)}>
                            {i.category}
                          </span>
                        </td>
                        <td className="cell-name">{i.description}</td>
                        <td>
                          <Money value={i.amount} tone="green" weight="strong" />
                        </td>
                        <td className="cell-note">{i.note || '-'}</td>
                        <td>
                          <IconButton
                            icon="delete"
                            tone="red"
                            label="Hapus pemasukan"
                            onClick={() => void handleDelete(i.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </>
        )}
      </div>

      {modalOpen && <IncomeModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

/** Alokasi gaji per akun — tiap baris di-edit sendiri-sendiri (klik untuk buka). */
function SalarySplit(): ReactNode {
  const { data, updateMonth, accounts } = useApp();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const salary = data.salary || 0;
  const allocated = totalAllocated(data);
  const rem = salary - allocated;

  const startEdit = (accountId: number, amount: number): void => {
    setEditingId(accountId);
    setDraft(amount > 0 ? String(Math.round(amount)) : '');
  };

  const save = (accountId: number): void => {
    const val = parseFloat(draft) || 0;
    updateMonth((d) => setAllocation(d, accountId, val));
    setEditingId(null);
    toast.success('Alokasi disimpan');
  };

  const tone = rem < 0 ? 'red' : rem === 0 ? 'green' : 'yellow';

  return (
    <div className="salary-split">
      <div className="section-label">Alokasi ke Akun Bank</div>
      <div>
        {accounts.map((a) => {
          const alloc = data.salaryAllocations.find((x) => x.accountId === a.id);
          const amt = alloc ? alloc.amount : 0;
          const editing = editingId === a.id;
          return (
            <div
              key={a.id}
              className={'split-row' + (editing ? ' editing' : '')}
              role="button"
              tabIndex={0}
              onClick={() => startEdit(a.id, amt)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  startEdit(a.id, amt);
                }
              }}
              title="Klik untuk ubah alokasi"
            >
              <div className="acc-color" style={{ background: a.color }} />
              <div className="acc-label">
                {a.bank} · {a.name}
              </div>
              <div className={'acc-alloc-display num' + (amt === 0 ? ' empty' : '')}>
                {amt > 0 ? fmtRp(amt) : 'Belum diatur'}
              </div>
              <div className="split-edit-wrap">
                <MoneyInput
                  className="split-input"
                  placeholder="0"
                  aria-label={`Alokasi untuk ${a.bank} ${a.name}`}
                  autoFocus={editing}
                  value={editing ? draft : amt ? String(Math.round(amt)) : ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={setDraft}
                  onKeyDown={(e) => e.key === 'Enter' && save(a.id)}
                />
                <button
                  className="split-save-btn"
                  aria-label="Simpan alokasi"
                  onClick={(e) => {
                    e.stopPropagation();
                    save(a.id);
                  }}
                >
                  <Icon name="check" size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`split-remaining tone-${tone}`}>
        <span>Total dialokasikan</span>
        <span className="num num-strong">
          {fmtRp(allocated)} / {fmtRp(salary)}
        </span>
        {rem > 0 && (
          <div className="split-remaining-note">Sisa belum dialokasikan: {fmtRp(rem)}</div>
        )}
        {rem < 0 && (
          <div className="split-remaining-note inline-warn">
            <Icon name="warn" size={12} /> Melebihi gaji sebesar {fmtRp(Math.abs(rem))}
          </div>
        )}
      </div>
    </div>
  );
}

function IncomeModal({ onClose }: { onClose: () => void }): ReactNode {
  const { updateMonth, currentDate } = useApp();
  const [date, setDate] = useState(() => defaultDateFor(currentDate));
  const [category, setCategory] = useState<string>(INCOME_CATS[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const submit = (): void => {
    const desc = description.trim();
    const amt = parseFloat(amount);
    if (!desc || !amt || amt <= 0) {
      toast.error('Lengkapi deskripsi dan jumlah');
      return;
    }
    updateMonth((d) => {
      d.income.push({
        id: nextId(d.income),
        date,
        category,
        description: desc,
        amount: amt,
        note,
      });
    });
    toast.success('Pemasukan tersimpan');
    onClose();
  };

  return (
    <Modal
      open
      icon="income"
      title="Penghasilan Tambahan"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Simpan Pemasukan
          </button>
        </>
      }
    >
      <FormRow>
        <Field label="Tanggal">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Kategori">
          <CategorySelect value={category} onChange={setCategory} options={INCOME_CATS} />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Deskripsi" full>
          <input
            type="text"
            placeholder="Contoh: Proyek desain website"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Jumlah (Rp)">
          <MoneyInput placeholder="500.000" value={amount} onChange={setAmount} />
        </Field>
        <Field label="Catatan">
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
