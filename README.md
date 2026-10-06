# NW28 Absensi

Aplikasi absensi dan upah harian per proyek untuk NW28 (Natawira Dwi Ashta).

## Isi

- `index.html` — seluruh aplikasi dalam satu file (tanpa build). Bisa di-hosting sebagai situs statis, misalnya di Vercel.
- `supabase/migrations/` — tabel dan fungsi database (Supabase / Postgres).

## Cara kerja

- Data disimpan sebagai satu dokumen bersama di tabel `nw28_state`. Tabel tidak bisa diakses langsung; baca dan tulis hanya lewat fungsi `nw28_load` dan `nw28_save`, yang memeriksa username dan password di server.
- Password disimpan sebagai hash (bcrypt) di tabel `nw28_users`. Login dikunci setelah 5 kali salah dalam 15 menit atau 20 kali dalam 24 jam.
- Kalau dua orang menyimpan bersamaan, penyimpanan kedua ditolak dan tampilannya dimuat ulang.

## Aturan upah

- Workshop NW28: jam normal 08:00–16:00 (istirahat 12:00–13:00), lembur flat per jam, istirahat lembur 18:00–19:00.
- Tim Garut: jam normal 07:00–17:00, lembur per jam, upah jadi 2x upah harian bila kerja sampai 23:00.
- Event: upah per argo 24 jam sejak jam berangkat.

Semua aturan bisa diubah di tab Aturan.

## Menambah atau mengganti pengguna

Jalankan di SQL editor Supabase (ganti nilai dalam tanda kutip):

```sql
insert into public.nw28_users (username, pass_hash)
values ('nama', extensions.crypt('password', extensions.gen_salt('bf', 10)))
on conflict (username) do update set pass_hash = excluded.pass_hash;
```
