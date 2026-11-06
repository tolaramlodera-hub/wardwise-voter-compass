create or replace function public.get_event_voter_details(p_event_id uuid)
returns table(id uuid, voter_id text, full_name text, relative_name text, house_number text, ward_id uuid)
language plpgsql security definer set search_path = public, private
as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.is_active=true) then
  raise exception 'सक्रिय अकाउंट आवश्यक है';
 end if;
 if not exists(select 1 from public.community_events e where e.id=p_event_id and
   (e.created_by=auth.uid() or e.organizer_id=auth.uid() or private.is_active_admin() or public.is_event_member(p_event_id))) then
  raise exception 'इस इवेंट की मतदाता जानकारी देखने की अनुमति नहीं है';
 end if;
 return query select v.id,v.voter_id,v.full_name,v.relative_name,v.house_number,v.ward_id
 from public.voters v where exists(select 1 from public.event_households h where h.event_id=p_event_id and v.id=any(h.voter_ids))
 order by v.house_number,v.full_name;
end;
$$;
revoke all on function public.get_event_voter_details(uuid) from public,anon;
grant execute on function public.get_event_voter_details(uuid) to authenticated;