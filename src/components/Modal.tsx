import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface ModalProps {
  open: boolean;
  title: ReactNode;
  icon?: IconName;
  onClose: () => void;
  children: ReactNode;
  /** Tombol aksi kanan bawah. Kosongkan kalau modal tidak punya tombol simpan. */
  actions?: ReactNode;
  maxWidth?: number;
}

/**
 * Overlay modal. Isi modal di-unmount saat tertutup, jadi field form ter-reset
 * otomatis — menggantikan pembersihan input manual di `closeModal()` app lama.
 *
 * Aksesibilitas yang sebelumnya tidak ada: `role="dialog"`, tutup dengan
 * Escape, fokus dipindahkan ke dalam dan dikembalikan saat ditutup, serta Tab
 * dikurung di dalam modal.
 */
export function Modal({
  open,
  title,
  icon,
  onClose,
  children,
  actions,
  maxWidth,
}: ModalProps): ReactNode {
  const boxRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] =>
      Array.from(
        boxRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));

    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={boxRef}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div className="modal-title" id={titleId}>
          {icon && <Icon name={icon} size={17} />}
          {title}
        </div>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function FormRow({ children }: { children: ReactNode }): ReactNode {
  return <div className="form-grid">{children}</div>;
}

interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  full?: boolean;
  labelColor?: string;
}

export function Field({ label, children, full, labelColor }: FieldProps): ReactNode {
  return (
    <div className="form-group" style={full ? { gridColumn: '1/-1' } : undefined}>
      <label style={labelColor ? { color: labelColor } : undefined}>{label}</label>
      {children}
    </div>
  );
}

interface AccountSelectProps {
  value: string;
  onChange: (value: string) => void;
  accounts: { id: number; bank: string; name: string }[];
  placeholder?: string;
}

export function AccountSelect({
  value,
  onChange,
  accounts,
  placeholder = '— Tidak dispesifikasi —',
}: AccountSelectProps): ReactNode {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.bank} - {a.name}
        </option>
      ))}
    </select>
  );
}

export function CategorySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}): ReactNode {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ icon, children }: { icon: IconName; children: ReactNode }): ReactNode {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={34} />
      </div>
      <p>{children}</p>
    </div>
  );
}

export function CardHeader({
  icon,
  dot,
  title,
  action,
}: {
  icon?: IconName;
  /** Warna titik penanda kartu, mengikuti sistem warna semantik. */
  dot?: 'green' | 'red' | 'yellow' | 'blue' | 'purple';
  title: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="card-header">
      <div className="card-title">
        {dot && <span className={`dot dot-${dot}`} />}
        {icon && <Icon name={icon} size={16} />}
        {title}
      </div>
      {action}
    </div>
  );
}

/** Tombol ikon-saja. `label` wajib: tanpa teks, screen reader butuh nama. */
export function IconButton({
  icon,
  label,
  onClick,
  tone = 'ghost',
}: {
  icon: IconName;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: 'ghost' | 'red';
}): ReactNode {
  return (
    <button
      className={`btn btn-${tone} btn-sm btn-icon`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} size={15} />
    </button>
  );
}
