import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { budgetProgress } from '../lib/calc';
import { catColor, fmtRp } from '../lib/format';
import { EXPENSE_CATS } from '../types';
import { CardHeader, EmptyState, Field, Modal } from './Modal';
import { Icon } from './Icon';
import { MoneyInput } from './MoneyInput';

export function BudgetTab(): ReactNode {
  const { data } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const rows = budgetProgress(data);
  const over = rows.filter((r) => r.budget > 0 && r.spent > r.budget);

  return (
    <>
      <div className="card">
        <CardHeader
          dot="blue"
          title="Budget"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}>
              <Icon name="settings" size={15} /> Atur Budget
            </button>
          }
        />
        {over.length > 0 && (
          <div className="alert alert-red">
            <Icon name="warn" size={16} />
            <span>
              <b>{over.length} kategori melebihi budget</b> — {over.map((r) => r.cat).join(', ')}
            </span>
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState
            icon="budget"
            hint="Pasang batas per kategori, biar tahu kapan waktunya ngerem."
            action={
              <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
                <Icon name="settings" size={15} /> Atur Budget
              </button>
            }
          >
            Belum ada batas budget
          </EmptyState>
        ) : (
          rows.map((r) => {
            const ratio = r.budget ? (r.spent / r.budget) * 100 : 0;
            const tone = ratio > 100 ? 'red' : ratio > 75 ? 'yellow' : 'green';
            return (
              <div key={r.cat} className="progress-wrap">
                <div className="progress-label">
                  <span className="cat-name" style={{ color: catColor(r.cat) }}>
                    {r.cat}
                  </span>
                  <span className="num">
                    {fmtRp(r.spent)}
                    {r.budget ? ` / ${fmtRp(r.budget)}` : ' · tanpa batas'}
                  </span>
                </div>
                {r.budget > 0 && (
                  <>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${r.pct}%`, background: `var(--${tone})` }}
                      />
                    </div>
                    {ratio > 100 ? (
                      <div className="inline-warn inline-warn-red">
                        <Icon name="warn" size={12} /> Melebihi budget {fmtRp(r.spent - r.budget)}
                      </div>
                    ) : ratio > 75 ? (
                      <div className="inline-warn inline-warn-yellow">
                        <Icon name="near" size={12} /> Mendekati batas
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {modalOpen && <BudgetModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

function BudgetModal({ onClose }: { onClose: () => void }): ReactNode {
  const { data, updateMonth } = useApp();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      EXPENSE_CATS.map((c) => {
        const v = data.budgets[c];
        return [c, v ? String(Math.round(v)) : ''];
      }),
    ),
  );

  const submit = (): void => {
    updateMonth((d) => {
      for (const cat of EXPENSE_CATS) {
        const val = parseFloat(values[cat] ?? '');
        if (val > 0) d.budgets[cat] = val;
        else delete d.budgets[cat];
      }
    });
    toast.success('Budget tersimpan');
    onClose();
  };

  return (
    <Modal
      open
      icon="budget"
      title="Budget per Kategori"
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-primary" onClick={submit}>
            Simpan Budget
          </button>
        </>
      }
    >
      <div className="modal-hint">Kosongkan untuk tidak ada batas</div>
      {EXPENSE_CATS.map((cat) => (
        <div key={cat} className="form-grid budget-row">
          <Field label={cat} labelColor={catColor(cat)}>
            <MoneyInput
              placeholder="Tidak ada batas"
              value={values[cat] ?? ''}
              onChange={(raw) => setValues((prev) => ({ ...prev, [cat]: raw }))}
            />
          </Field>
        </div>
      ))}
    </Modal>
  );
}
