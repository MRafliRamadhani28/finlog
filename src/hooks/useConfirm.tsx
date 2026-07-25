import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal } from '../components/Modal';

/**
 * Pengganti `window.confirm()` + modal hapus milik app lama, jadi satu dialog
 * reusable. API-nya Promise supaya call site tetap sependek versi lama:
 *   `if (!(await confirm({ ... }))) return;`
 */
export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }): ReactNode {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      setPending((p) => {
        p?.resolve(ok);
        return null;
      });
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={pending !== null}
        icon={pending?.danger === false ? undefined : 'warn'}
        title={pending?.title ?? ''}
        onClose={() => close(false)}
        maxWidth={380}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => close(false)}>
              {pending?.cancelLabel ?? 'Batal'}
            </button>
            <button
              className={'btn ' + (pending?.danger === false ? 'btn-primary' : 'btn-red')}
              onClick={() => close(true)}
            >
              {pending?.confirmLabel ?? 'Hapus'}
            </button>
          </>
        }
      >
        <p className="modal-text">{pending?.message ?? 'Item ini akan dihapus permanen.'}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm harus dipakai di dalam <ConfirmProvider>');
  return ctx;
}

/** Shortcut konfirmasi hapus (default modal lama). */
export function useConfirmDelete(): (message?: ReactNode) => Promise<boolean> {
  const confirm = useConfirm();
  return useCallback(
    (message) => confirm({ title: 'Hapus Item?', message: message ?? undefined }),
    [confirm],
  );
}
