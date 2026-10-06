create extension if not exists pgcrypto with schema extensions;

create table public.nw28_users (
  username text primary key,
  pass_hash text not null,
  created_at timestamptz not null default now()
);
create table public.nw28_fail (
  id bigint generated always as identity primary key,
  username text not null,
  at timestamptz not null default now()
);
create index nw28_fail_user_at on public.nw28_fail (username, at);
create table public.nw28_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
insert into public.nw28_state (id) values (1);

alter table public.nw28_users enable row level security;
alter table public.nw28_fail enable row level security;
alter table public.nw28_state enable row level security;
revoke all on public.nw28_users, public.nw28_fail, public.nw28_state from anon, authenticated;

-- returns 'ok' | 'bad' | 'locked'
create function public.nw28_check(p_user text, p_pass text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_user text := lower(trim(coalesce(p_user, '')));
  v_hash text;
  v_15m int;
  v_24h int;
begin
  select count(*) filter (where at > now() - interval '15 minutes'), count(*)
    into v_15m, v_24h
    from public.nw28_fail where username = v_user and at > now() - interval '24 hours';
  if v_15m >= 5 or v_24h >= 20 then return 'locked'; end if;
  select pass_hash into v_hash from public.nw28_users where username = v_user;
  if v_hash is not null and v_hash = extensions.crypt(coalesce(p_pass, ''), v_hash) then
    return 'ok';
  end if;
  if v_hash is not null then
    insert into public.nw28_fail (username) values (v_user);
  end if;
  return 'bad';
end $$;

create function public.nw28_load(p_user text, p_pass text, p_have bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_st text := public.nw28_check(p_user, p_pass);
  r public.nw28_state;
begin
  if v_st <> 'ok' then return jsonb_build_object('status', v_st); end if;
  select * into r from public.nw28_state where id = 1;
  if p_have is not null and p_have = r.version then
    return jsonb_build_object('status', 'ok', 'version', r.version);
  end if;
  return jsonb_build_object('status', 'ok', 'version', r.version, 'data', r.data,
                            'updated_by', r.updated_by, 'updated_at', r.updated_at);
end $$;

create function public.nw28_save(p_user text, p_pass text, p_data jsonb, p_version bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_st text := public.nw28_check(p_user, p_pass);
  v_new bigint;
begin
  if v_st <> 'ok' then return jsonb_build_object('status', v_st); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or not (p_data ? 'workers') then
    return jsonb_build_object('status', 'invalid');
  end if;
  update public.nw28_state
     set data = p_data, version = version + 1, updated_by = lower(trim(p_user)), updated_at = now()
   where id = 1 and version = p_version
   returning version into v_new;
  if v_new is null then return jsonb_build_object('status', 'conflict'); end if;
  return jsonb_build_object('status', 'ok', 'version', v_new);
end $$;

revoke all on function public.nw28_check(text, text) from public, anon, authenticated;
revoke all on function public.nw28_load(text, text, bigint) from public;
revoke all on function public.nw28_save(text, text, jsonb, bigint) from public;
grant execute on function public.nw28_load(text, text, bigint) to anon, authenticated;
grant execute on function public.nw28_save(text, text, jsonb, bigint) to anon, authenticated;
