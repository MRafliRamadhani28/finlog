import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirm } from '../hooks/useConfirm';
import {
  deleteAllData,
  exportAll,
  importAll,
  importableKeys,
  monthKey,
  removeMonth,
} from '../lib/storage';
import { today } from '../lib/format';
import { CardHeader } from './Modal';
import { Icon } from './Icon';

export function DataTab(): ReactNode {
  const { currentDate, reloadAll } = useApp();
  const confirm = useConfirm();
  const [exportText, setExportText] = useState('');
  const [importText, setImportText] = useState('');

  const generate = (): void => {
    setExportText(JSON.stringify(exportAll(), null, 2));
    toast.success('Data berhasil di-generate');
  };

  /** Backup yang sebenarnya: file, bukan copy-paste 50 kB JSON di layar HP. */
  const download = (): void => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catatan-keuangan-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Backup diunduh');
  };

  const pickFile = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then((text) => setImportText(text));
    };
    input.click();
  };

  const copy = (): void => {
    if (!exportText) {
      toast.error('Generate data dulu!');
      return;
    }
    navigator.clipboard.writeText(exportText).then(
      () => toast.success('Disalin ke clipboard'),
      () => toast.error('Gagal menyalin — salin manual dari kotak di atas.'),
    );
  };

  const doImport = async (): Promise<void> => {
    const text = importText.trim();
    if (!text) {
      toast.error('Tempel data terlebih dahulu!');
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      const raw: unknown = JSON.parse(text);
      if (raw === null || typeof raw !== 'object') throw new Error('bukan objek');
      parsed = raw as Record<string, unknown>;
    } catch {
      toast.error('JSON tidak valid!');
      return;
    }
    const keys = importableKeys(parsed);
    if (keys.length === 0) {
      toast.error('Format data tidak valid!');
      return;
    }
    const ok = await confirm({
      title: 'Import Data?',
      message: `Import ${keys.length} data? Data existing akan ditimpa.`,
      confirmLabel: 'Import',
    });
    if (!ok) return;
    importAll(parsed, keys);
    setImportText('');
    reloadAll();
    toast.success(`Import ${keys.length} data berhasil`);
  };

  const delMonth = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Hapus Data Bulan Ini?',
      message: 'Semua transaksi bulan ini akan dihapus permanen.',
    });
    if (!ok) return;
    removeMonth(monthKey(currentDate));
    reloadAll();
    toast.success('Data bulan ini dihapus');
  };

  const delAll = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Hapus SEMUA Data?',
      message: 'Semua bulan, akun bank, dan wishlist akan dihapus. Tidak bisa dibatalkan!',
      confirmLabel: 'Hapus Semua',
    });
    if (!ok) return;
    deleteAllData();
    reloadAll();
    toast.success('Semua data dihapus');
  };

  return (
    <>
      <div className="card">
        <CardHeader dot="green" icon="download" title="Export Data" />
        <p className="card-note">
          Semua data keuangan (seluruh bulan + akun bank + wishlist). Unduh file untuk backup, atau
          generate untuk menyalin manual.
        </p>
        <div className="row row-wrap mb-3">
          <button className="btn btn-green" onClick={download}>
            <Icon name="download" size={15} /> Unduh File Backup
          </button>
          <button className="btn btn-ghost" onClick={generate}>
            <Icon name="refresh" size={15} /> Generate &amp; Tampilkan
          </button>
          {exportText && (
            <button className="btn btn-ghost" onClick={copy}>
              <Icon name="copy" size={15} /> Salin
            </button>
          )}
        </div>
        {exportText && <div className="export-area">{exportText}</div>}
      </div>

      <div className="card">
        <CardHeader dot="blue" icon="upload" title="Import Data" />
        <p className="card-note">
          Pilih file backup, atau tempel isinya di bawah.{' '}
          <b className="text-red">Data existing akan ditimpa.</b>
        </p>
        <button className="btn btn-ghost btn-sm mb-2" onClick={pickFile}>
          <Icon name="file" size={15} /> Pilih File Backup
        </button>
        <textarea
          className="import-area"
          placeholder="Paste JSON data backup di sini..."
          aria-label="Isi data backup"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div className="row mt-3">
          <button className="btn btn-primary" onClick={() => void doImport()}>
            <Icon name="upload" size={15} /> Import &amp; Terapkan
          </button>
          <button className="btn btn-ghost" onClick={() => setImportText('')}>
            Bersihkan
          </button>
        </div>
      </div>

      <div className="card danger-card">
        <CardHeader dot="red" icon="warn" title="Hapus Data" />
        <p className="card-note">
          Tidak ada tombol Urungkan di sini. Unduh backup dulu sebelum melanjutkan.
        </p>
        <div className="row row-wrap">
          <button className="btn btn-red btn-sm" onClick={() => void delMonth()}>
            <Icon name="delete" size={15} /> Hapus Bulan Ini
          </button>
          <button className="btn btn-red btn-sm" onClick={() => void delAll()}>
            <Icon name="warn" size={15} /> Hapus Semua Data
          </button>
        </div>
      </div>
    </>
  );
}
