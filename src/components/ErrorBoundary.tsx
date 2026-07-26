import { Component, type ErrorInfo, type ReactNode } from 'react';
import { exportAll } from '../lib/storage';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Jaring pengaman terakhir. Tanpa ini, satu entry data yang rusak (mis. hasil
 * import JSON asing) bikin layar putih total — termasuk tab Data yang justru
 * dibutuhkan untuk memperbaikinya.
 *
 * Layar ini tetap memberi jalan menyelamatkan data: unduh backup mentah
 * langsung dari localStorage, tanpa melewati React.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Aplikasi berhenti:', error, info.componentStack);
  }

  private downloadRaw = (): void => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catatan-keuangan-darurat-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app">
        <div className="card error-screen">
          <div className="card-title mb-3">
            <span className="dot dot-red" /> Aplikasi berhenti
          </div>
          <p className="card-note">
            Ada data yang tidak bisa dibaca. Datamu masih tersimpan di browser — unduh backup-nya
            dulu sebelum melakukan apa pun.
          </p>
          <pre className="error-detail">{error.message}</pre>
          <div className="row row-wrap">
            <button className="btn btn-green" onClick={this.downloadRaw}>
              Unduh Backup
            </button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Muat Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
