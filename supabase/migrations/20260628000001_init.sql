-- xlmcode — initial schema. All access is via the Express backend:
--   * per-request client (publishable key + user cookie) → RLS via auth.uid()
--   * admin client (secret key) → bypasses RLS, only for system writes (usage, etc.)
-- RLS is enabled + deny-by-default on every table. Policies target `authenticated`.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
create type plan_type as enum ('hacker', 'studio', 'admin');
create type model_type as enum ('XLM_MINI', 'XLM_PRO', 'XLM_MAX');
create type message_role as enum ('user', 'assistant');

-- ─────────────────────────────────────────────────────────────────────────────
-- plans — rate-limit config per plan (customizable). daily/first-day prompt caps.
-- ─────────────────────────────────────────────────────────────────────────────
create table plans (
  name             plan_type primary key,
  first_day_limit  int not null,   -- prompts allowed on the registration day
  daily_limit      int not null,   -- prompts/day afterwards (-1 = unlimited)
  created_at       timestamptz not null default now()
);

insert into plans (name, first_day_limit, daily_limit) values
  ('hacker', 50, 20),
  ('studio', 500, 500),
  ('admin', -1, -1);

-- ─────────────────────────────────────────────────────────────────────────────
-- models — our brand tiers → provider models + pricing. Toggle from here.
-- ─────────────────────────────────────────────────────────────────────────────
create table models (
  model_type                model_type primary key,
  provider                  text not null default 'openai',
  provider_model            text not null,
  input_usd_per_mtok        numeric not null,
  cached_input_usd_per_mtok numeric not null,
  output_usd_per_mtok       numeric not null,
  enabled                   boolean not null default true,
  is_default                boolean not null default false,
  updated_at                timestamptz not null default now()
);

insert into models (model_type, provider_model, input_usd_per_mtok, cached_input_usd_per_mtok, output_usd_per_mtok, is_default) values
  ('XLM_MINI', 'gpt-5.4-mini', 0.75, 0.075, 4.50, true),
  ('XLM_PRO',  'gpt-5.4',      2.50, 0.25,  15.00, false),
  ('XLM_MAX',  'gpt-5.5',      5.00, 0.50,  30.00, false);

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — 1:1 with auth.users. plan/is_admin/limits are NOT user-editable.
-- ─────────────────────────────────────────────────────────────────────────────
create table profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text,
  name                     text,
  avatar_url               text,
  plan                     plan_type not null default 'hacker',
  is_admin                 boolean not null default false,
  first_day_limit_override int,
  daily_limit_override     int,
  prompts_today            int not null default 0,
  prompts_day              date,
  created_at               timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- projects — one project == one conversation. owner-scoped.
-- ─────────────────────────────────────────────────────────────────────────────
create table projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  slug          text not null,
  name          text not null,
  current_files jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index projects_owner_idx on projects(owner_id, created_at desc);

create table project_versions (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  seq        int not null,
  label      text,
  summary    text,
  files      jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, seq)
);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  seq               int not null,
  role              message_role not null,
  content           text not null default '',
  files             jsonb,
  version_id        uuid references project_versions(id) on delete set null,
  stats             jsonb,
  actions           jsonb,
  actions_done      boolean not null default false,
  kind              text,
  model_type        model_type,
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  cost_usd          numeric not null default 0,
  created_at        timestamptz not null default now(),
  unique (project_id, seq)
);

create table deployed_contracts (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  manifest_id  text not null,
  name         text,
  category     text,
  contract_id  text not null,
  network      text not null default 'testnet',
  tx_hash      text,
  explorer_url text,
  deployer     text,
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index deployed_contracts_project_idx on deployed_contracts(project_id);

-- Public read-only share links (token-based). The backend resolves a token with
-- the admin client and returns a read-only view (anonymous viewers can clone).
create table project_shares (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token      text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- usage_events — token/cost accounting (visibility now, billing later). Writes
-- only via the admin client (no INSERT policy → RLS denies the authenticated role).
create table usage_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles(id) on delete cascade,
  project_id        uuid references projects(id) on delete set null,
  message_id        uuid references messages(id) on delete set null,
  kind              text not null,           -- 'generation' | 'guardrail'
  model_type        model_type,
  provider_model    text,
  prompt_tokens     int not null default 0,
  completion_tokens int not null default 0,
  cost_usd          numeric not null default 0,
  created_at        timestamptz not null default now()
);
create index usage_events_user_idx on usage_events(user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger projects_touch before update on projects
  for each row execute function touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- New auth user → profile (default plan 'hacker'). Runs as definer.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Protect privileged profile columns from the user (only the admin client /
-- service_role, where auth.uid() is null, may change plan/is_admin/limits).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function guard_profile_privileges() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.is_admin                 is distinct from old.is_admin
    or new.plan                     is distinct from old.plan
    or new.first_day_limit_override is distinct from old.first_day_limit_override
    or new.daily_limit_override     is distinct from old.daily_limit_override
    or new.prompts_today            is distinct from old.prompts_today
    or new.prompts_day              is distinct from old.prompts_day
  ) then
    raise exception 'not allowed to modify privileged profile fields';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_privileges();

-- ─────────────────────────────────────────────────────────────────────────────
-- consume_prompt — atomic rate limit. Returns true if allowed (and counts it),
-- false if the daily/first-day cap is hit. Admins are unlimited.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function consume_prompt(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  prof   profiles%rowtype;
  cap    int;
  is_first_day boolean;
begin
  select * into prof from profiles where id = p_user for update;
  if not found then return false; end if;
  if prof.is_admin then return true; end if;

  -- reset the daily counter when the day rolls over
  if prof.prompts_day is distinct from current_date then
    update profiles set prompts_today = 0, prompts_day = current_date where id = p_user;
    prof.prompts_today := 0;
  end if;

  is_first_day := (prof.created_at::date = current_date);
  if is_first_day then
    cap := coalesce(prof.first_day_limit_override, (select first_day_limit from plans where name = prof.plan));
  else
    cap := coalesce(prof.daily_limit_override, (select daily_limit from plans where name = prof.plan));
  end if;

  if cap >= 0 and prof.prompts_today >= cap then
    return false;
  end if;

  update profiles set prompts_today = prompts_today + 1, prompts_day = current_date where id = p_user;
  return true;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- restore_version — set current files to a version and DELETE every later
-- version (destructive, by design). Owner-only.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function restore_version(p_project uuid, p_version uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_seq int;
  v_label text;
  v_files jsonb;
  next_seq int;
begin
  if not exists (select 1 from projects where id = p_project and owner_id = auth.uid()) then
    raise exception 'not found';
  end if;
  select seq, label, files into v_seq, v_label, v_files
    from project_versions where id = p_version and project_id = p_project;
  if not found then raise exception 'version not found'; end if;

  update projects set current_files = v_files where id = p_project;
  delete from project_versions where project_id = p_project and seq > v_seq;

  select coalesce(max(seq), 0) + 1 into next_seq from messages where project_id = p_project;
  insert into messages (project_id, seq, role, content, kind)
    values (p_project, next_seq, 'assistant', 'Restored "' || coalesce(v_label, 'version') || '".', 'system');
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- clone_project — copy a project (files + versions + messages) into a NEW project
-- owned by the caller. Contracts are NOT copied (the cloner redeploys their own).
-- Works for the owner OR via a valid share token. Returns the new project id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function clone_project(p_source uuid, p_share_token text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src projects%rowtype;
  new_id uuid;
  allowed boolean;
begin
  select * into src from projects where id = p_source;
  if not found then raise exception 'source not found'; end if;

  allowed := (src.owner_id = auth.uid())
    or (p_share_token is not null and exists (
          select 1 from project_shares where project_id = p_source and token = p_share_token));
  if not allowed then raise exception 'not allowed'; end if;

  insert into projects (owner_id, slug, name, current_files)
    values (auth.uid(), src.slug || '-clone', src.name || ' (clone)', src.current_files)
    returning id into new_id;

  insert into project_versions (project_id, seq, label, summary, files, created_at)
    select new_id, seq, label, summary, files, created_at
    from project_versions where project_id = p_source;

  insert into messages (project_id, seq, role, content, files, stats, actions, actions_done, kind, model_type, prompt_tokens, completion_tokens, cost_usd, created_at)
    select new_id, seq, role, content, files, stats, actions, actions_done, kind, model_type, 0, 0, 0, created_at
    from messages where project_id = p_source;

  return new_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — enable everywhere, deny by default, then add policies.
-- `authenticated` = the per-request client (auth.uid() set). service_role bypasses.
-- ─────────────────────────────────────────────────────────────────────────────
alter table plans              enable row level security;
alter table models             enable row level security;
alter table profiles           enable row level security;
alter table projects           enable row level security;
alter table project_versions   enable row level security;
alter table messages           enable row level security;
alter table deployed_contracts enable row level security;
alter table project_shares     enable row level security;
alter table usage_events       enable row level security;

-- plans / models — read-only reference data for any logged-in user
create policy plans_read  on plans  for select to authenticated using (true);
create policy models_read on models for select to authenticated using (true);

-- profiles — read/update only your own row (privileged columns guarded by trigger)
create policy profiles_select on profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- helper: does the current user own this project?
create or replace function owns_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and owner_id = (select auth.uid()));
$$;

-- projects — full CRUD for the owner only
create policy projects_select on projects for select to authenticated using (owner_id = (select auth.uid()));
create policy projects_insert on projects for insert to authenticated with check (owner_id = (select auth.uid()));
create policy projects_update on projects for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy projects_delete on projects for delete to authenticated using (owner_id = (select auth.uid()));

-- child tables — gated by project ownership
create policy versions_all  on project_versions for all to authenticated using (owns_project(project_id)) with check (owns_project(project_id));
create policy messages_all   on messages          for all to authenticated using (owns_project(project_id)) with check (owns_project(project_id));
create policy contracts_all  on deployed_contracts for all to authenticated using (owns_project(project_id)) with check (owns_project(project_id));
create policy shares_all     on project_shares     for all to authenticated using (owns_project(project_id)) with check (owns_project(project_id));

-- usage_events — user can read their own; INSERTs happen only via the admin client
create policy usage_select on usage_events for select to authenticated using (user_id = (select auth.uid()));
