create table if not exists public.nw28_foto (
  id text primary key check (length(id) between 4 and 64),
  thumb text not null,
  full_img text not null,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.nw28_foto enable row level security;
revoke all on public.nw28_foto from anon, authenticated;

create or replace function public.nw28_foto_put(p_user text, p_pass text, p_id text, p_thumb text, p_full text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_st text := public.nw28_check(p_user, p_pass);
begin
  if v_st <> 'ok' then return jsonb_build_object('status', v_st); end if;
  if p_id is null or p_thumb is null or p_full is null
     or length(p_thumb) > 400000 or length(p_full) > 3000000
     or left(p_thumb, 11) <> 'data:image/' or left(p_full, 11) <> 'data:image/' then
    return jsonb_build_object('status', 'invalid');
  end if;
  insert into public.nw28_foto (id, thumb, full_img, created_by)
  values (p_id, p_thumb, p_full, lower(trim(p_user)))
  on conflict (id) do nothing;
  return jsonb_build_object('status', 'ok', 'id', p_id);
end $$;

create or replace function public.nw28_foto_get(p_user text, p_pass text, p_ids text[], p_full boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_st text := public.nw28_check(p_user, p_pass); v_out jsonb;
begin
  if v_st <> 'ok' then return jsonb_build_object('status', v_st); end if;
  select coalesce(jsonb_object_agg(id, case when p_full then full_img else thumb end), '{}'::jsonb) into v_out
  from public.nw28_foto where id = any (p_ids[1:60]);
  return jsonb_build_object('status', 'ok', 'foto', v_out);
end $$;

revoke all on function public.nw28_foto_put(text, text, text, text, text) from public;
revoke all on function public.nw28_foto_get(text, text, text[], boolean) from public;
grant execute on function public.nw28_foto_put(text, text, text, text, text) to anon, authenticated;
grant execute on function public.nw28_foto_get(text, text, text[], boolean) to anon, authenticated;
