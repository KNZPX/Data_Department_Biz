-- Applied to Supabase project wwnzwsjquostxfpjerla on 2026-10-02 via MCP
-- (migration: team_settings_and_prefs_merge).

-- 1. Team-wide settings (e.g. the announcement banner everyone sees).
--    Anyone signed in can read; only admins can change. Reached only through
--    SECURITY DEFINER functions keyed by the caller's session hash.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;

create or replace function public.app_settings_get(p_session text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare u public.app_users; r public.app_settings;
begin
  select * into u from public._session_user(p_session);
  if u.email is null or not u.is_active then return null; end if;
  select * into r from public.app_settings where key = p_key;
  if r.key is null then return '{}'::jsonb; end if;
  return jsonb_build_object('value', r.value, 'updatedBy', r.updated_by, 'updatedAt', r.updated_at);
end $$;

create or replace function public.app_settings_set(p_session text, p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare u public.app_users; now_ts timestamptz := now();
begin
  u := public._require_admin(p_session);
  if p_key !~ '^[a-z_]{1,40}$' then raise exception 'Invalid setting.'; end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' or length(p_value::text) > 8000 then
    raise exception 'Invalid value.';
  end if;
  insert into public.app_settings (key, value, updated_by, updated_at)
  values (p_key, p_value, coalesce(nullif(u.name, ''), u.email), now_ts)
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now_ts;
  return jsonb_build_object('value', p_value, 'updatedBy', coalesce(nullif(u.name, ''), u.email), 'updatedAt', now_ts);
end $$;

revoke all on function public.app_settings_get(text, text) from public;
revoke all on function public.app_settings_set(text, text, jsonb) from public;
grant execute on function public.app_settings_get(text, text) to anon, authenticated;
grant execute on function public.app_settings_set(text, text, jsonb) to anon, authenticated;

-- 2. Personal preferences now merge by top-level key, so saving the look
--    (appearance) doesn't wipe other saved choices (e.g. report workspaces).
create or replace function public.user_prefs_set(p_session text, p_prefs jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s public.app_sessions;
begin
  select * into s from public.app_sessions where id = p_session;
  if s.id is null then raise exception 'Sign in first.'; end if;
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' or length(p_prefs::text) > 20000 then
    raise exception 'Invalid preferences.';
  end if;
  insert into public.user_preferences (email, prefs, updated_at)
  values (lower(s.user_email), p_prefs, now())
  on conflict (email) do update set prefs = public.user_preferences.prefs || excluded.prefs, updated_at = now();
end $$;
