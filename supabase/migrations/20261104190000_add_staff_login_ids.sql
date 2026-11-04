alter table public.profiles add column if not exists login_id text;
create unique index if not exists profiles_login_id_unique
  on public.profiles (lower(login_id))
  where login_id is not null;
comment on column public.profiles.login_id is
  'Admin-assigned username used for password login; Supabase Auth stores a private synthetic email identifier.';