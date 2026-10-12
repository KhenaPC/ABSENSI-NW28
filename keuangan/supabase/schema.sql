-- NW28 Keuangan: struktur database (proyek Supabase "NW28 Keuangan").
-- Tabel tertutup oleh RLS tanpa policy; akses hanya lewat fungsi keu_* (security definer) yang memeriksa token sesi.
-- Fungsi: keu_login, keu_logout, keu_passwd, keu_list, keu_get, keu_put, keu_del, keu_me, keu_users_list, keu_set_akses, keu_log_list.
-- Riwayat: tabel keu_log diisi otomatis oleh keu_put, keu_del, keu_set_akses, keu_passwd (waktu, user, aksi, data sebelum/sesudah).
-- Peran: owner (mengatur akses), staff (semua proyek), admin (hanya proyek di kolom akses, tanpa overhead, tidak bisa ubah proyek).
-- "Hapus" berarti diarsipkan (deleted_at terisi), barisnya tidak hilang dari database.

create extension if not exists pgcrypto with schema extensions;

create table public.keu_users (username text primary key, pass_hash text not null, created_at timestamptz not null default now(),
  role text not null default 'staff' check (role in ('owner','staff','admin')), akses text[] not null default '{}');
create table public.keu_fail (id bigint generated always as identity primary key, username text not null, at timestamptz not null default now());
create table public.keu_docs (
  coll text not null check (coll in ('proyek','transaksi','bukti')),
  id text not null check (id ~ '^[A-Za-z0-9_.-]{1,80}$'),
  data jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text,
  primary key (coll, id)
);
create table public.keu_sessions (
  token text primary key,
  username text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.keu_users enable row level security;
alter table public.keu_fail enable row level security;
alter table public.keu_docs enable row level security;
alter table public.keu_sessions enable row level security;
revoke all on public.keu_users, public.keu_fail, public.keu_docs, public.keu_sessions from anon, authenticated;

-- Menambah pengguna (jalankan di SQL editor Supabase, ganti nilainya):
-- insert into public.keu_users (username, pass_hash)
-- values ('nama', extensions.crypt('password-awal', extensions.gen_salt('bf', 10)));

-- Isi fungsi keu_* ada di riwayat migrasi proyek Supabase:
-- keu_tables, keu_session_lookup, keu_read_functions, keu_write_function, keu_auth_and_archive, keu_roles_akses, keu_riwayat_log.
