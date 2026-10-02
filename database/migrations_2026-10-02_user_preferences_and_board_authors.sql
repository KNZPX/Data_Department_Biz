-- Applied to Supabase project wwnzwsjquostxfpjerla on 2026-10-02 via MCP
-- (migration: user_preferences_per_user_appearance).
-- Per-user UI preferences (appearance). Reached only through SECURITY DEFINER
-- functions keyed by the caller's session hash, like app_sessions.
create table if not exists public.user_preferences (
  email text primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
revoke all on table public.user_preferences from anon, authenticated;

create or replace function public.user_prefs_get(p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare s public.app_sessions; r jsonb;
begin
  select * into s from public.app_sessions where id = p_session;
  if s.id is null then return null; end if;
  select prefs into r from public.user_preferences where email = lower(s.user_email);
  return coalesce(r, '{}'::jsonb);
end $$;

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
  if p_prefs is null or jsonb_typeof(p_prefs) <> 'object' or length(p_prefs::text) > 4000 then
    raise exception 'Invalid preferences.';
  end if;
  insert into public.user_preferences (email, prefs, updated_at)
  values (lower(s.user_email), p_prefs, now())
  on conflict (email) do update set prefs = excluded.prefs, updated_at = now();
end $$;

revoke all on function public.user_prefs_get(text) from public;
revoke all on function public.user_prefs_set(text, jsonb) from public;
grant execute on function public.user_prefs_get(text) to anon, authenticated;
grant execute on function public.user_prefs_set(text, jsonb) to anon, authenticated;

-- Applied 2026-10-02 via MCP (run as separate statements; the migration tool timed out).
-- Who made a board and who changed it last (boards list: Owner / "Modified by").
alter table public.whiteboard_boards add column if not exists created_by text;
alter table public.whiteboard_boards add column if not exists updated_by text;

create or replace function public.whiteboard_boards_set_creator()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by := coalesce(new.created_by, new.updated_by);
  return new;
end $$;

create trigger whiteboard_boards_set_creator
before insert on public.whiteboard_boards
for each row execute function public.whiteboard_boards_set_creator();
