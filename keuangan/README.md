# NW28 Keuangan

Rekap keuangan proyek NW28: RAB, pemasukan, pengeluaran, alokasi proyek, laba rugi, serta unduh PDF dan Excel.

- `index.html` adalah seluruh aplikasinya (satu file statis, tanpa proses build).
- Data disimpan di proyek Supabase "NW28 Keuangan". Browser hanya memanggil fungsi `keu_*`, dan setiap fungsi memeriksa sesi login. Tabelnya tidak bisa dibaca langsung dari luar.
- Password pengguna disimpan terenkripsi (bcrypt) di database, tidak ada di repo ini.
- `supabase/schema.sql` berisi struktur tabel dan fungsi, untuk dokumentasi.
- Dipasang di Vercel dengan Root Directory `keuangan`.

Scan bukti transfer otomatis hanya tersedia di versi Claude. Di versi ini bukti tetap bisa diunggah dan angkanya diisi manual.
