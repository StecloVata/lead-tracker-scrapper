-- Run this once in the Supabase SQL editor to remove scraper tables.
-- scrape_candidates must be dropped first (it references scrape_jobs).
drop table if exists public.scrape_candidates;
drop table if exists public.scrape_jobs;
