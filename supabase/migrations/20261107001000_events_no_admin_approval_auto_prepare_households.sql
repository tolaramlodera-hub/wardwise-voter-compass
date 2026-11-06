-- Events no longer wait for an administrator approval.
update public.community_events
set status = 'approved',
    organizer_id = coalesce(organizer_id, created_by)
where status = 'pending';

create or replace function public.prepare_event_households(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null or not exists (
    select 1 from public.profiles p
    where p.user_id = v_user and p.is_active = true
  ) then raise exception 'सक्रिय अकाउंट आवश्यक है'; end if;
  if not exists (
    select 1 from public.community_events e
    where e.id = p_event_id and e.status = 'approved'
      and (e.created_by = v_user or e.organizer_id = v_user or private.is_active_admin())
  ) then raise exception 'इस इवेंट की सूची तैयार करने की अनुमति नहीं है'; end if;
  insert into public.event_households(event_id,ward_id,house_number,household_label,voter_ids)
  select p_event_id,v.ward_id,v.house_number,'',array_agg(v.id order by v.id)
  from public.voters v
  where v.ward_id is not null and v.house_number is not null and btrim(v.house_number)<>''
  group by v.ward_id,v.house_number
  on conflict (event_id,ward_id,house_number,household_label) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.prepare_event_households(uuid) from public,anon;
grant execute on function public.prepare_event_households(uuid) to authenticated;