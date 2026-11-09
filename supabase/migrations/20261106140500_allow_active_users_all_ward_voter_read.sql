-- Let authenticated, active users browse the voter directory across all active wards.
-- Writes remain restricted by the existing admin-only management policies.
create policy "active_users_read_all_active_wards"
on public.wards for select to authenticated
using (
  is_active and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true
  )
);

create policy "active_users_read_voters_all_wards"
on public.voters for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.is_active = true
  )
);
