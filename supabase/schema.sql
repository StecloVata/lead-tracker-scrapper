-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Leads table
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company text not null,
  country text default '',
  city text default '',
  vertical text default '',
  tier integer default 2 check (tier in (1, 2, 3)),
  size text default '',
  website text default '',
  persona text default '',
  trigger text default '',
  notes text default '',
  status text default 'Not contacted',
  is_priority boolean default false,
  ai_score integer default null,
  ai_reasoning text default null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contacts table
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  name text default '',
  role text default '',
  phone text default '',
  email text default '',
  linkedin text default '',
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.leads enable row level security;
alter table public.contacts enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view own leads" on public.leads;
drop policy if exists "Users can insert own leads" on public.leads;
drop policy if exists "Users can update own leads" on public.leads;
drop policy if exists "Users can delete own leads" on public.leads;
drop policy if exists "Users can view own contacts" on public.contacts;
drop policy if exists "Users can insert own contacts" on public.contacts;
drop policy if exists "Users can update own contacts" on public.contacts;
drop policy if exists "Users can delete own contacts" on public.contacts;

-- Leads policies
create policy "Users can view own leads"
  on public.leads for select
  using (auth.uid() = user_id);

create policy "Users can insert own leads"
  on public.leads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own leads"
  on public.leads for update
  using (auth.uid() = user_id);

create policy "Users can delete own leads"
  on public.leads for delete
  using (auth.uid() = user_id);

-- Contacts policies
create policy "Users can view own contacts"
  on public.contacts for select
  using (
    lead_id in (select id from public.leads where user_id = auth.uid())
  );

create policy "Users can insert own contacts"
  on public.contacts for insert
  with check (
    lead_id in (select id from public.leads where user_id = auth.uid())
  );

create policy "Users can update own contacts"
  on public.contacts for update
  using (
    lead_id in (select id from public.leads where user_id = auth.uid())
  );

create policy "Users can delete own contacts"
  on public.contacts for delete
  using (
    lead_id in (select id from public.leads where user_id = auth.uid())
  );

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_leads_updated on public.leads;
create trigger on_leads_updated
  before update on public.leads
  for each row execute procedure public.handle_updated_at();

-- =============================================
-- Scraper: Job Queue
-- =============================================
create table if not exists public.scrape_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  source        text not null,
  params        jsonb default '{}',
  status        text default 'pending'
                check (status in ('pending','running','done','failed')),
  result_count  int default 0,
  dupe_count    int default 0,
  error_message text,
  created_at    timestamptz default now(),
  finished_at   timestamptz
);

alter table public.scrape_jobs enable row level security;

drop policy if exists "Users manage own scrape jobs" on public.scrape_jobs;
create policy "Users manage own scrape jobs" on public.scrape_jobs
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Scraper: Candidate Staging Area
-- =============================================
create table if not exists public.scrape_candidates (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references public.scrape_jobs(id) on delete cascade,
  user_id             uuid references auth.users(id) on delete cascade not null,

  company             text not null,
  website             text default '',
  country             text default '',
  vertical            text default '',
  tier                integer default 2,
  size                text default '',
  notes               text default '',
  linkedin_url        text default '',

  emails              text[]  default '{}',
  phones              text[]  default '{}',
  people              jsonb   default '[]',
  tech_stack          text[]  default '{}',

  is_duplicate        boolean default false,
  duplicate_match     text    default '',
  duplicate_lead_id   uuid references public.leads(id) on delete set null,

  icp_score           int default 0,
  review_status       text default 'pending'
                      check (review_status in ('pending','approved','rejected')),
  created_at          timestamptz default now()
);

alter table public.scrape_candidates enable row level security;

drop policy if exists "Users manage own scrape candidates" on public.scrape_candidates;
create policy "Users manage own scrape candidates" on public.scrape_candidates
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================
-- Signal Tool
-- =============================================

-- Track when each lead was last scanned for signals
alter table public.leads
  add column if not exists last_signal_check timestamptz default null;

-- Signals table
create table if not exists public.signals (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references public.leads(id) on delete cascade not null,
  signal_type  text not null check (signal_type in ('funding', 'hiring', 'leadership_change', 'expansion', 'pain_point', 'tech_change', 'event', 'press')),
  title        text not null,
  description  text default '',
  source_url   text default '',
  urgency      integer default 2 check (urgency in (1, 2, 3)),
  detected_at  timestamptz default now(),
  is_read      boolean default false
);

-- RLS for signals (scoped through lead → user)
alter table public.signals enable row level security;

drop policy if exists "Users can view own signals" on public.signals;
drop policy if exists "Users can insert own signals" on public.signals;
drop policy if exists "Users can update own signals" on public.signals;
drop policy if exists "Users can delete own signals" on public.signals;

create policy "Users can view own signals"
  on public.signals for select
  using (lead_id in (select id from public.leads where user_id = auth.uid()));

create policy "Users can insert own signals"
  on public.signals for insert
  with check (lead_id in (select id from public.leads where user_id = auth.uid()));

create policy "Users can update own signals"
  on public.signals for update
  using (lead_id in (select id from public.leads where user_id = auth.uid()));

create policy "Users can delete own signals"
  on public.signals for delete
  using (lead_id in (select id from public.leads where user_id = auth.uid()));
