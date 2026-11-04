-- Allow official electoral-roll rows that do not contain an EPIC / voter ID.
-- The existing UNIQUE constraint still prevents duplicate non-null voter IDs;
-- PostgreSQL permits multiple NULL values in a normal unique constraint.
alter table public.voters alter column voter_id drop not null;
