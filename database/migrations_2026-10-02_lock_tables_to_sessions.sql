-- Applied to Supabase project wwnzwsjquostxfpjerla on 2026-10-02 via MCP
-- (after the app version that sends x-app-session was live in production).
--
-- Before: 13 tables were readable/writable by anyone holding the public anon
-- key ("open all" policies, or RLS off on the DAX tables), including
-- app_users and the legacy powerbi_token row.
-- After: a request only reaches these tables when it carries the SHA-256 hash
-- of a live sign-in session in the x-app-session header. The Next.js server
-- adds it from the httpOnly session cookie (src/lib/db.ts); browsers never see
-- the hash, so the anon key alone reads and writes nothing.

create or replace function public._request_session_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_sessions s
    where s.id = nullif(current_setting('request.headers', true)::json ->> 'x-app-session', '')
      and coalesce(s.last_seen_at, s.created_at) > now() - interval '31 days'
      and not exists (
        select 1 from public.app_users u
        where lower(u.email) = lower(s.user_email) and u.is_active = false
      )
  )
$$;
revoke all on function public._request_session_ok() from public;
grant execute on function public._request_session_ok() to anon, authenticated;

-- Applied as ALTER POLICY on the existing "<table> open all" policies (same
-- names kept), plus new "signed-in sessions" policies on the two DAX tables
-- that had RLS off. A temporary "probe" policy on change_log (used to confirm
-- production requests carried a live session before locking) was altered to
-- the same rule.
alter policy "change_log open all" on public.change_log using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "dax_imports open all" on public.dax_imports using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "dax_model_relationships open all" on public.dax_model_relationships using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "dax_model_tables open all" on public.dax_model_tables using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "dax_models open all" on public.dax_models using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "powerbi_items open all" on public.powerbi_items using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "powerbi_licenses open all" on public.powerbi_licenses using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "powerbi_permissions open all" on public.powerbi_permissions using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "target_scenarios open all" on public.target_scenarios using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "whiteboard_boards open all" on public.whiteboard_boards using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter policy "app_users read" on public.app_users using ((select public._request_session_ok()));

create policy "signed-in sessions" on public.dax_annotations for all to anon, authenticated using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
create policy "signed-in sessions" on public.dax_dictionary_items for all to anon, authenticated using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
alter table public.dax_annotations enable row level security;
alter table public.dax_dictionary_items enable row level security;

-- app_users is changed only through the admin_* / user_record_login functions.
revoke insert, update, delete on table public.app_users from anon, authenticated;

-- Legacy single-token table: unused since tokens moved to per-session rows.
alter policy "powerbi_token open all" on public.powerbi_token using (false) with check (false);
revoke all on table public.powerbi_token from anon, authenticated;
