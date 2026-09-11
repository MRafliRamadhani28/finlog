import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Field, Modal } from './Modal';
import {
  CloudError,
  decideOnLogin,
  pull,
  push,
  replaceLocal,
  signIn,
  signOut,
  type LoginDecision,
  type Snapshot,
} from '../lib/cloud';
import { exportAll } from '../lib/storage';

interface LoginModalProps {
  onClose: () => void;
  onLoggedIn: (email: string, replacedLocal: boolean) => void;
}

type Stage = { kind: 'form' } | { kind: 'choose'; cloud: Snapshot; updatedAt: string };

const WRONG_CREDENTIALS = [400, 401, 403];
const SYNC_FAILED = 'Gagal menyinkronkan data cloud. Coba lagi.';

export function LoginModal({ onClose, onLoggedIn }: LoginModalProps): ReactNode {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'form' });

  const cancel = useCallback((): void => {
    if (busy) return;
    if (stage.kind === 'choose') void signOut();
    onClose();
  }, [busy, stage.kind, onClose]);

  const finish = async (decision: LoginDecision, cloud: Snapshot | null): Promise<void> => {
    if (decision === 'push') await push();
    if (decision === 'pull' && cloud) replaceLocal(cloud);
    onLoggedIn(email.trim(), decision === 'pull');
  };

  const fail = async (message: string): Promise<void> => {
    await signOut();
    setStage({ kind: 'form' });
    setError(message);
    setBusy(false);
  };

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof CloudError && WRONG_CREDENTIALS.includes(err.status)
          ? 'Email atau password salah.'
          : 'Tidak bisa terhubung ke server.',
      );
      setBusy(false);
      return;
    }
    try {
      const cloud = await pull();
      const decision = decideOnLogin(exportAll(), cloud?.data ?? null);
      if (decision === 'ask' && cloud) {
        setStage({ kind: 'choose', cloud: cloud.data, updatedAt: cloud.updatedAt });
        setBusy(false);
        return;
      }
      await finish(decision, cloud?.data ?? null);
    } catch {
      await fail(SYNC_FAILED);
    }
  };

  const choose = async (decision: 'push' | 'pull'): Promise<void> => {
    if (stage.kind !== 'choose') return;
    setBusy(true);
    try {
      await finish(decision, stage.cloud);
    } catch {
      await fail(SYNC_FAILED);
    }
  };

  if (stage.kind === 'choose') {
    return (
      <Modal
        open
        icon="warn"
        title="Data Berbeda"
        onClose={cancel}
        maxWidth={420}
        actions={
          <>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void choose('push')}>
              Pakai data device ini
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void choose('pull')}>
              Pakai data cloud
            </button>
          </>
        }
      >
        <p className="modal-text">
          Data di device ini berbeda dengan data cloud (terakhir diperbarui{' '}
          {new Date(stage.updatedAt).toLocaleString('id-ID')}). Pilih yang dipakai; yang lain akan
          ditimpa.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      icon="lock"
      title="Masuk"
      onClose={cancel}
      maxWidth={380}
      actions={
        <>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>
            Batal
          </button>
          <button type="submit" form="login-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Memproses…' : 'Masuk'}
          </button>
        </>
      }
    >
      <form id="login-form" onSubmit={(e) => void submit(e)}>
        <Field label="Email" full>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" full>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p className="text-red" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
