import { useState, type ReactNode } from 'react';
import { toast } from '../lib/toast';
import { useApp } from '../hooks/useApp';
import { useConfirmDelete } from '../hooks/useConfirm';
import { useUndoableDelete } from '../hooks/useUndoableDelete';
import { daysAgo, fmtRp, today } from '../lib/format';
import { nextId } from '../lib/id';
import {
  PRIORITY_META,
  WL_EMOJI_BG,
  WL_PRIORITY_ORDER,
  WL_RIBBON,
  WL_STATUS_CONFIG,
  WL_STATUS_ORDER,
} from '../lib/constants';
import {
  WL_PRIORITIES,
  WL_STATUSES,
  type WishlistItem,
  type WishlistPriority,
  type WishlistStatus,
} from '../types';
import { EmptyState, Field, FormRow, IconButton, Modal } from './Modal';
import { Icon, type IconName } from './Icon';
import { Money } from './Money';
import { MoneyInput } from './MoneyInput';

type Filter = 'all' | WishlistStatus | 'segera' | 'impian';

const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
  { key: 'all', label: 'Semua', icon: 'wishlist' },
  { key: 'wishlist', label: 'Wishlist', icon: 'star' },
  { key: 'saving', label: 'Ditabung', icon: 'saving' },
  { key: 'achieved', label: 'Tercapai', icon: 'check' },
  { key: 'segera', label: 'Segera', icon: 'near' },
  { key: 'impian', label: 'Impian', icon: 'star' },
];

const EMPTY_MSG: Record<Filter, string> = {
  all: 'Tambahkan impianmu — set prioritas dan harga target, lalu pantau progresnya.',
  wishlist: 'Belum ada item berstatus Wishlist.',
  saving: 'Belum ada yang sedang ditabung.',
  achieved: 'Belum ada yang tercapai. Terus menabung!',
  segera: 'Tidak ada item berprioritas Segera.',
  impian: 'Tidak ada item berprioritas Impian.',
};

const PRIORITY_LABELS: Record<WishlistPriority, string> = {
  biasa: 'Biasa',
  pengen: 'Pengen',
  banget: 'Pengen Banget',
  impian: 'Impian',
  segera: 'Segera!',
};

const STATUS_LABELS: Record<WishlistStatus, string> = {
  wishlist: 'Wishlist',
  saving: 'Sedang Ditabung',
  achieved: 'Tercapai',
};

export function WishlistTab(): ReactNode {
  const { wishlist, updateWishlist } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<WishlistItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const confirmDelete = useConfirmDelete();
  const undoable = useUndoableDelete();

  const totalVal = wishlist.filter((w) => w.status !== 'achieved').reduce((s, w) => s + w.price, 0);

  const stats: { label: string; value: ReactNode; tone: string }[] = [
    { label: 'Total Item', value: wishlist.length, tone: 'var(--text)' },
    {
      label: 'Tercapai',
      value: wishlist.filter((w) => w.status === 'achieved').length,
      tone: 'var(--green)',
    },
    {
      label: 'Ditabung',
      value: wishlist.filter((w) => w.status === 'saving').length,
      tone: 'var(--blue)',
    },
    {
      label: 'Wishlist',
      value: wishlist.filter((w) => w.status === 'wishlist').length,
      tone: 'var(--purple)',
    },
    { label: 'Total Nilai', value: fmtRp(totalVal), tone: 'var(--gold)' },
  ];

  const filtered = wishlist.filter((w) => {
    if (filter === 'all') return true;
    if (filter === 'segera' || filter === 'impian') return w.priority === filter;
    return w.status === filter;
  });

  // Sort: status dulu (ditabung → wishlist → tercapai), baru prioritas.
  const sorted = [...filtered].sort((a, b) => {
    if (a.status !== b.status)
      return (WL_STATUS_ORDER[a.status] ?? 1) - (WL_STATUS_ORDER[b.status] ?? 1);
    return (WL_PRIORITY_ORDER[a.priority] ?? 4) - (WL_PRIORITY_ORDER[b.priority] ?? 4);
  });

  const cycleStatus = (id: number): void => {
    const cycle: Record<WishlistStatus, WishlistStatus> = {
      wishlist: 'saving',
      saving: 'achieved',
      achieved: 'wishlist',
    };
    updateWishlist((list) => {
      const item = list.find((w) => w.id === id);
      if (item) item.status = cycle[item.status] ?? 'wishlist';
    });
  };

  const remove = async (id: number): Promise<void> => {
    if (!(await confirmDelete())) return;
    undoable.wishlist('Wishlist dihapus', (list) => {
      const idx = list.findIndex((w) => w.id === id);
      if (idx > -1) list.splice(idx, 1);
    });
  };

  return (
    <>
      <div className="card wishlist-card">
        <div className="wl-hero">
          <div className="row-between">
            <div>
              <div className="wl-hero-title">Daftar Keinginan</div>
              <div className="wl-hero-sub">
                Catat impianmu, pantau perkembangannya, rayakan saat tercapai.
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Icon name="add" size={15} /> Tambah
            </button>
          </div>
        </div>

        <div className="wishlist-stats">
          {stats.map((s) => (
            <div key={s.label} className="wl-stat">
              <div className="wl-stat-label">{s.label}</div>
              <div className="wl-stat-val num" style={{ color: s.tone }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="wishlist-filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              className={'wl-filter' + (filter === f.key ? ' active' : '')}
              onClick={() => setFilter(f.key)}
            >
              <Icon name={f.icon} size={13} /> {f.label}
            </button>
          ))}
        </div>

        <div className="wl-grid">
          {sorted.length === 0 ? (
            <div className="wl-empty">
              <EmptyState icon="wishlist">{EMPTY_MSG[filter]}</EmptyState>
            </div>
          ) : (
            sorted.map((item) => {
              const sc = WL_STATUS_CONFIG[item.status] ?? WL_STATUS_CONFIG.wishlist;
              const meta = PRIORITY_META[item.priority] ?? PRIORITY_META.biasa;
              const ago = daysAgo(item.dateAdded);
              const priceTone =
                item.priority === 'impian' ? 'gold' : item.priority === 'segera' ? 'red' : 'green';
              return (
                <div
                  key={item.id}
                  className={'wl-card' + (item.status === 'achieved' ? ' achieved' : '')}
                  data-priority={item.priority}
                >
                  <div
                    className="wl-card-ribbon"
                    style={{ background: WL_RIBBON[item.priority] ?? WL_RIBBON.biasa }}
                  />
                  {item.status === 'achieved' && (
                    <div className="wl-achieved-stamp">
                      <Icon name="check" size={18} />
                    </div>
                  )}
                  <div className="wl-card-top">
                    {/* Emoji di sini adalah konten milik user, bukan ikon UI. */}
                    <div
                      className="wl-emoji-wrap"
                      style={{ background: WL_EMOJI_BG[item.priority] ?? WL_EMOJI_BG.biasa }}
                    >
                      {item.emoji || '🌟'}
                    </div>
                    <div className="wl-name">{item.name}</div>
                    {item.price > 0 && (
                      <div className="wl-price">
                        <Money value={item.price} tone={priceTone} weight="strong" />
                      </div>
                    )}
                    <div className={'row row-wrap' + (item.note ? ' mb-2' : '')}>
                      <span className={'badge ' + meta.cls}>{meta.label}</span>
                    </div>
                    {item.note && <div className="wl-note">{item.note}</div>}
                    {ago && (
                      <div className="wl-date">
                        <Icon name="clock" size={12} /> {ago}
                      </div>
                    )}
                  </div>
                  <div className="wl-card-bottom">
                    <button
                      className={sc.cls + ' wl-status-btn'}
                      title="Klik untuk ubah status"
                      onClick={() => cycleStatus(item.id)}
                    >
                      {sc.label} <span className="wl-status-next">{sc.next}</span>
                    </button>
                    <div className="row row-tight">
                      <IconButton
                        icon="edit"
                        label={`Edit ${item.name}`}
                        onClick={() => {
                          setEditing(item);
                          setModalOpen(true);
                        }}
                      />
                      <IconButton
                        icon="delete"
                        tone="red"
                        label={`Hapus ${item.name}`}
                        onClick={() => void remove(item.id)}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {modalOpen && (
        <WishlistModal
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

function WishlistModal({
  editing,
  onClose,
}: {
  editing: WishlistItem | null;
  onClose: () => void;
}): ReactNode {
  const { updateWishlist } = useApp();
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '');
  const [price, setPrice] = useState(editing?.price ? String(Math.round(editing.price)) : '');
  const [priority, setPriority] = useState<WishlistPriority>(editing?.priority ?? 'biasa');
  const [status, setStatus] = useState<WishlistStatus>(editing?.status ?? 'wishlist');
  const [note, setNote] = useState(editing?.note ?? '');

  const submit = (): void => {
    const nm = name.trim();
    if (!nm) {
      toast.error('Isi nama item!');
      return;
    }
    const fields = {
      name: nm,
      emoji: emoji || '🌟',
      price: parseFloat(price) || 0,
      priority,
      status,
      note: note.trim(),
    };
    updateWishlist((list) => {
      const idx = editing ? list.findIndex((w) => w.id === editing.id) : -1;
      if (idx > -1) {
        list[idx] = { ...list[idx]!, ...fields };
      } else {
        list.push({ id: nextId(list), ...fields, dateAdded: today() });
      }
    });
    toast.success(editing ? 'Wishlist diperbarui' : 'Wishlist ditambahkan');
    onClose();
  };

  return (
    <Modal
      open
      icon="wishlist"
      title={editing ? 'Edit Wishlist' : 'Tambah Wishlist'}
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
        <Field label="Nama Item">
          <input
            type="text"
            placeholder="Contoh: MacBook Pro"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Emoji / Ikon">
          <input
            type="text"
            placeholder="🎯"
            maxLength={4}
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          />
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Harga Target (Rp)">
          <MoneyInput placeholder="Opsional" value={price} onChange={setPrice} />
        </Field>
        <Field label="Prioritas">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as WishlistPriority)}
          >
            {WL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as WishlistStatus)}>
            {WL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </FormRow>
      <FormRow>
        <Field label="Catatan" full>
          <input
            type="text"
            placeholder="Contoh: Untuk kerja remote, ukuran 14 inch"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </FormRow>
    </Modal>
  );
}
