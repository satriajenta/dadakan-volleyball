# Dadakan Volleyball Tournament — Sistem Pendaftaran & Portal Admin (MySQL + PHP)

Aplikasi web turnamen bola voli untuk pendaftaran tim, verifikasi manual pembayaran, dan manajemen roster atlet, ditenagai oleh **PHP & MySQL (XAMPP)**.

---

## Fitur Utama

- **Pendaftaran Tim**:
  - Pendaftaran 6–12 pemain resmi per tim dengan validasi nomor punggung unik (0–99).
  - Unggah bukti transfer (Transfer Bank / QRIS) format JPG, PNG, atau PDF (maks. 5 MB) ke folder `uploads/proofs/`.
  - Otomatis membuat kode registrasi unik `DV-XXXXXX`.
- **Cek Status Pendaftaran**:
  - Kapten dapat memantau status persetujuan menggunakan kode pendaftaran dan 4 digit terakhir nomor WhatsApp.
  - Menampilkan catatan panitia jika ada berkas yang perlu diperbaiki.
- **Portal Admin & Dashboard (`admin.html`)**:
  - Login aman menggunakan `password_hash()` bcrypt.
  - Kartu KPI: Total Pendaftar, Menunggu Verifikasi, Tim Diterima, Ditolak, dan Total Atlet.
  - Fitur pencarian instan dan filter status (Semua, Menunggu, Diterima, Ditolak).
  - Modal susunan roster (nama & nomor punggung pemain).
  - Modal pratinjau bukti transfer/QRIS.
  - Verifikasi: Tombol **Terima** dan **Tolak** disertai catatan perbaikan.
  - Ekspor seluruh data pendaftaran dan roster pemain ke **CSV (Excel)**.

---

## Kebutuhan Sistem

- **XAMPP** (Apache, PHP 7.4+ / 8.x, dan MySQL / MariaDB).

---

## Panduan Instalasi & Penggunaan (XAMPP)

### 1. Letakkan Folder di `htdocs`
Pastikan folder ini berada di direktori XAMPP:
```
C:\xampp\htdocs\dadakan-volleyball-cloud\
```

### 2. Jalankan Apache & MySQL
Buka **XAMPP Control Panel**, lalu klik **Start** pada modul:
- **Apache** (Web Server & PHP)
- **MySQL** (Database Server)

### 3. Konfigurasi Database MySQL
Sistem dilengkapi fitur **Auto-Migration**. Saat aplikasi dibuka pertama kali, database `dadakan_volleyball`, seluruh tabel, dan akun admin default akan **dibuat secara otomatis**!

*Opsi Manual (Opsional)*:
Jika ingin mengimpor database secara manual:
1. Buka browser: `http://localhost/phpmyadmin`
2. Buat database baru bernama: `dadakan_volleyball`
3. Klik tab **Import** dan pilih berkas `database.sql`.

---

## Akun Login Admin Bawaan

| Keterangan | Nilai |
| :--- | :--- |
| **URL Portal Admin** | `http://localhost/dadakan-volleyball-cloud/admin.html` |
| **Email Admin** | `admin@dadakan.com` |
| **Password** | `admin123` |

---

## Struktur Database MySQL

### 1. `admin_users`
Menyimpan akun administrator turnamen.
- `id` (INT, Primary Key, Auto Increment)
- `email` (VARCHAR 120, Unique)
- `password_hash` (VARCHAR 255)
- `full_name` (VARCHAR 100)
- `created_at` (TIMESTAMP)

### 2. `registrations`
Menyimpan identitas tim, kapten, dan transaksi pembayaran.
- `id` (INT, Primary Key, Auto Increment)
- `code` (VARCHAR 15, Unique, format `DV-XXXXXX`)
- `team_name` (VARCHAR 70)
- `origin` (VARCHAR 100)
- `captain_name` (VARCHAR 70)
- `whatsapp` (VARCHAR 25)
- `email` (VARCHAR 120)
- `manager_name` (VARCHAR 70)
- `payment_method` (ENUM 'Transfer bank', 'QRIS')
- `payer_name` (VARCHAR 70)
- `proof_path` (VARCHAR 255, lokasi file di `uploads/proofs/`)
- `status` (ENUM 'pending', 'approved', 'rejected')
- `payment_verified` (TINYINT 1)
- `admin_note` (TEXT)
- `created_at` (TIMESTAMP)
- `reviewed_at` (TIMESTAMP)

### 3. `registration_players`
Menyimpan susunan atlet (6–12 pemain) dengan relasi `CASCADE` ke tabel pendaftaran.
- `id` (INT, Primary Key, Auto Increment)
- `registration_id` (INT, Foreign Key ke `registrations.id`)
- `player_name` (VARCHAR 70)
- `jersey_number` (INT, Unique per tim)
- `created_at` (TIMESTAMP)

---

## Struktur File Proyek

```
dadakan-volleyball-cloud/
├── api/
│   ├── db.php             # Koneksi PDO MySQL & auto-migrator tabel
│   ├── register.php       # Endpoint pendaftaran tim & upload bukti transfer
│   ├── check-status.php   # Endpoint cek status pendaftaran oleh tim
│   ├── auth.php           # Endpoint login admin, cek sesi, dan logout
│   └── admin.php          # Endpoint dashboard data, approval, dan export CSV
├── uploads/
│   └── proofs/            # Direktori penyimpanan bukti transfer
├── assets/                # Banner dan gambar turnamen
├── database.sql           # Skema database MySQL & data awal admin
├── index.html             # Halaman publik pendaftaran tim & cek status
├── app.js                 # Logika JavaScript frontend publik
├── style.css              # Tampilan umum turnamen bola voli
├── admin.html             # Halaman login & dashboard admin turnamen
├── admin.js               # Logika JavaScript dashboard admin
├── admin.css              # Tampilan dashboard admin
└── README.md              # Dokumentasi lengkap proyek
```

---

## Pengujian Aplikasi di Browser

- **Halaman Pendaftaran Peserta**: `http://localhost/dadakan-volleyball-cloud/index.html`
- **Halaman Portal Admin**: `http://localhost/dadakan-volleyball-cloud/admin.html`
