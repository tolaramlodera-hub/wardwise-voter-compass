create or replace function public.list_event_callers()
returns table(user_id uuid, full_name text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.full_name, p.role
  from public.profiles p
  where p.is_active = true
    and p.role = 'staff'
    and exists (
      select 1 from public.profiles me
      where me.user_id = auth.uid() and me.is_active = true
    )
  order by p.full_name;
$$;

revoke all on function public.list_event_callers() from public, anon;
grant execute on function public.list_event_callers() to authenticated;
