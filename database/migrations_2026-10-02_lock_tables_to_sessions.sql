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

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'change_log', 'dax_annotations', 'dax_dictionary_items', 'dax_imports',
    'dax_model_relationships', 'dax_model_tables', 'dax_models',
    'powerbi_items', 'powerbi_licenses', 'powerbi_permissions',
    'target_scenarios', 'whiteboard_boards', 'app_users'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select polname from pg_policy where polrelid = format('public.%I', t)::regclass loop
      execute format('drop policy %I on public.%I', p.polname, t);
    end loop;
    execute format(
      'create policy "signed-in sessions" on public.%I for all to anon, authenticated using ((select public._request_session_ok())) with check ((select public._request_session_ok()))',
      t
    );
  end loop;
end $$;

-- app_users is changed only through the admin_* / user_record_login functions.
revoke insert, update, delete on table public.app_users from anon, authenticated;

-- Legacy single-token table: unused since tokens moved to per-session rows.
alter table public.powerbi_token enable row level security;
drop policy if exists "powerbi_token open all" on public.powerbi_token;
revoke all on table public.powerbi_token from anon, authenticated;
