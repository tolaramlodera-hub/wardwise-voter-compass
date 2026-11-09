create table if not exists public.voter_account_links (
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 voter_id uuid not null references public.voters(id) on delete cascade,
 relation text not null default 'family_member' check (relation in ('self','family_member')),
 created_at timestamptz not null default now(),
 primary key(user_id,voter_id), unique(voter_id)
);
alter table public.voter_account_links enable row level security;
create policy "account holders read own voter links" on public.voter_account_links for select to authenticated using (user_id=auth.uid());
create policy "account holders add own voter links" on public.voter_account_links for insert to authenticated with check (user_id=auth.uid());
create policy "admins read voter links" on public.voter_account_links for select to authenticated using (public.is_active_admin());
create policy "users create own pending voter profile" on public.profiles for insert to authenticated with check (user_id=auth.uid() and role='voter' and is_active=false);
create policy "users read own profile" on public.profiles for select to authenticated using (user_id=auth.uid());
