import type { ReactNode } from 'react';
import { CardHeader } from './Modal';
import { Icon, type IconName } from './Icon';

/** Rujukan ke tab lain di dalam teks panduan — ikon + nama, bukan emoji. */
function Tab({ icon, children }: { icon: IconName; children: ReactNode }): ReactNode {
  return (
    <b className="guide-ref">
      <Icon name={icon} size={13} />
      {children}
    </b>
  );
}

const SECTIONS: { title: string; steps: { num: number; heading: string; body: ReactNode }[] }[] = [
  {
    title: 'Pemasukan & Akun Bank',
    steps: [
      {
        num: 1,
        heading: 'Setup Akun Bank',
        body: (
          <>
            Buka tab <Tab icon="account">Akun Bank</Tab> lalu klik <b>Tambah Akun</b>. Isi nama
            akun, nama bank, nomor rekening (opsional), dan pilih warna penanda. Akun berlaku global
            — tidak per bulan.
          </>
        ),
      },
      {
        num: 2,
        heading: 'Set Gaji & Alokasi ke Rekening',
        body: (
          <>
            Tab <Tab icon="income">Pemasukan</Tab> → klik <b>Edit</b> → isi nominal gaji → Simpan.
            Jika sudah ada akun bank, form alokasi muncul otomatis. Isi berapa yang masuk ke setiap
            rekening.
          </>
        ),
      },
      {
        num: 3,
        heading: 'Penghasilan Tambahan',
        body: (
          <>
            Klik <b>Tambah</b> di kartu Penghasilan Tambahan. Isi tanggal, kategori (Freelance /
            Bonus / Lainnya), deskripsi, dan jumlah.
          </>
        ),
      },
    ],
  },
  {
    title: 'Tunai & Pengeluaran',
    steps: [
      {
        num: 4,
        heading: 'Catat Penarikan Tunai',
        body: (
          <>
            Tab <Tab icon="cash">Tunai</Tab> → <b>Tarik Tunai</b>. Pilih dari akun mana, isi jumlah
            dan deskripsi. Penarikan mengurangi saldo. Klik barisnya untuk membuka rincian
            pengeluaran tunainya.
          </>
        ),
      },
      {
        num: 5,
        heading: 'Detail Pengeluaran Tunai',
        body: (
          <>
            Setelah tarik tunai, buka item → klik <b>Tambah Detail</b>. Isi untuk apa uang tunai itu
            digunakan. Sisa yang belum dirinci ditampilkan sebagai "Belum tercatat".
          </>
        ),
      },
      {
        num: 6,
        heading: 'Pengeluaran Non-Tunai',
        body: (
          <>
            Tab <Tab icon="expense">Pengeluaran</Tab> → <b>Tambah</b> untuk transfer, kartu debit,
            atau pembayaran digital. Pilih kategori, isi deskripsi, jumlah, dan rekening sumber.
          </>
        ),
      },
    ],
  },
  {
    title: 'Rencana, Piutang & Fitur Lain',
    steps: [
      {
        num: 7,
        heading: 'Rencana Pengeluaran',
        body: (
          <>
            Tab <Tab icon="planned">Rencana</Tab> → tambahkan pengeluaran yang belum terjadi.
            Totalnya tampil merah di panel atas. Centang item saat sudah dibayar → otomatis masuk
            Pengeluaran Aktual. Item terceklis terkunci sampai centangnya dibatalkan.
          </>
        ),
      },
      {
        num: 8,
        heading: 'Piutang',
        body: (
          <>
            Tab <Tab icon="piutang">Piutang</Tab> → catat uang yang dipinjamkan. Saldo langsung
            berkurang. Klik badge <b>Belum Lunas</b> untuk menandai lunas → saldo pulih. Entry
            piutang di tab Pengeluaran hanya bisa dihapus lewat tab Piutang.
          </>
        ),
      },
      {
        num: 9,
        heading: 'Wishlist',
        body: (
          <>
            Tab <Tab icon="wishlist">Wishlist</Tab> → catat impian belanja. Set prioritas, harga
            target, dan emoji. Wishlist bersifat global — tidak bergantung pada bulan. Status
            berputar: Wishlist → Ditabung → Tercapai.
          </>
        ),
      },
      {
        num: 10,
        heading: 'Backup & Restore',
        body: (
          <>
            Tab <Tab icon="data">Data</Tab> → <b>Unduh File Backup</b>. Untuk memulihkan: pilih file
            backup lalu Import. Data hanya tersimpan di browser ini — rutin backup!
          </>
        ),
      },
    ],
  },
];

export function GuideTab({ onStartTutorial }: { onStartTutorial: () => void }): ReactNode {
  return (
    <div className="card">
      <CardHeader
        icon="guide"
        title="Panduan Penggunaan"
        action={
          <button className="btn btn-primary btn-sm" onClick={onStartTutorial}>
            <Icon name="play" size={15} /> Tutorial Interaktif
          </button>
        }
      />
      <p className="card-note">Referensi lengkap fitur aplikasi ini.</p>
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="guide-section-title">{section.title}</div>
          {section.steps.map((step) => (
            <div key={step.num} className="guide-step">
              <div className="guide-num num">{step.num}</div>
              <div className="guide-content">
                <h4>{step.heading}</h4>
                <p>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
