-- Applied to Supabase project wwnzwsjquostxfpjerla on 2026-10-02 via MCP.
-- Team collaboration on DAX items: comments (with @mentions), review status,
-- watching an item, and per-person notifications. Same access rule as the rest
-- of the app (migrations_2026-10-02_lock_tables_to_sessions.sql): only requests
-- carrying a live session hash get through. That file defines
-- public._request_session_ok(); it is repeated here so this file stands alone.

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

create table if not exists public.dax_comments (
  id uuid primary key default gen_random_uuid(),
  item_id text not null,
  model_code text,
  item_name text,
  body text not null check (length(body) between 1 and 4000),
  author_email text not null,
  author_name text,
  mentions text[] not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists dax_comments_item_idx on public.dax_comments (item_id, created_at);

create table if not exists public.dax_item_reviews (
  item_id text primary key,
  status text not null default 'draft' check (status in ('draft', 'reviewed')),
  reviewed_by text,
  reviewed_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.dax_watches (
  item_id text not null,
  user_email text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, user_email)
);
create index if not exists dax_watches_user_idx on public.dax_watches (user_email);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  kind text not null,
  title text not null,
  body text,
  link text,
  actor text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists app_notifications_user_idx on public.app_notifications (user_email, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['dax_comments', 'dax_item_reviews', 'dax_watches', 'app_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "signed-in sessions" on public.%I', t);
    execute format(
      'create policy "signed-in sessions" on public.%I for all to anon, authenticated using ((select public._request_session_ok())) with check ((select public._request_session_ok()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- EBO & OKR plans: one row per CoE / SBU (and hospital, or ALL) per year.
create table if not exists public.okr_plans (
  id text primary key,
  year int not null,
  unit text not null,
  site text not null default 'ALL',
  data jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists okr_plans_year_idx on public.okr_plans (year);
alter table public.okr_plans enable row level security;
create policy "signed-in sessions" on public.okr_plans for all to anon, authenticated using ((select public._request_session_ok())) with check ((select public._request_session_ok()));
