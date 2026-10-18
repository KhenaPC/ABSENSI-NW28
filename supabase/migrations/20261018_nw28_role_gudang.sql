-- Peran pengguna: admin (akses penuh) dan gudang (hanya bagian Alat).
-- Kepala gudang tidak menerima data gaji/absensi/kasbon dan hanya bisa menyimpan bagian alat.
alter table public.nw28_users add column if not exists role text not null default 'admin';
alter table public.nw28_users drop constraint if exists nw28_users_role_check;
alter table public.nw28_users add constraint nw28_users_role_check check (role in ('admin','gudang'));
-- Fungsi nw28_role, nw28_data_gudang, serta versi baru nw28_load / nw28_save:
-- lihat definisi lengkap yang dipasang di project Supabase (migration "nw28_role_gudang").
-- Menambah akun gudang:
-- insert into public.nw28_users (username, pass_hash, role)
-- values ('nama', extensions.crypt('password', extensions.gen_salt('bf', 10)), 'gudang');
