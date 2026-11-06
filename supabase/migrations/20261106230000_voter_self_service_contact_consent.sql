create or replace function public.get_my_voter_contact()
returns table(phone text, consent_to_event_contact boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(vc.phone, pcs.phone) as phone,
         coalesce(vc.consent_to_event_contact, pcs.consent_to_event_contact, false) as consent_to_event_contact
  from public.voter_account_links l
  join public.profiles p on p.user_id = l.user_id and p.is_active = true and p.role = 'voter'
  left join public.voter_contacts vc on vc.voter_id = l.voter_id
  left join public.pending_voter_contact_submissions pcs on pcs.user_id = l.user_id
  where l.user_id = auth.uid()
  order by l.created_at
  limit 1;
$$;

create or replace function public.update_my_voter_contact(p_phone text, p_consent_to_event_contact boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'लॉगिन आवश्यक है'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'सही 10 अंकों का मोबाइल नंबर भरें'; end if;
  if not exists (select 1 from public.profiles where user_id = v_user and role = 'voter' and is_active = true) then
    raise exception 'सक्रिय मतदाता अकाउंट आवश्यक है';
  end if;
  if not exists (select 1 from public.voter_account_links where user_id = v_user) then
    raise exception 'इस अकाउंट से मतदाता रिकॉर्ड लिंक नहीं है';
  end if;
  insert into public.voter_contacts(voter_id, phone, consent_to_event_contact, consent_recorded_at, updated_by, updated_at)
  select l.voter_id, p_phone, p_consent_to_event_contact,
         case when p_consent_to_event_contact then now() else null end, v_user, now()
  from public.voter_account_links l
  where l.user_id = v_user
  on conflict (voter_id) do update set
    phone = excluded.phone,
    consent_to_event_contact = excluded.consent_to_event_contact,
    consent_recorded_at = excluded.consent_recorded_at,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;
  update public.pending_voter_contact_submissions
  set phone = p_phone, consent_to_event_contact = p_consent_to_event_contact
  where user_id = v_user;
end;
$$;

revoke all on function public.get_my_voter_contact() from public, anon;
revoke all on function public.update_my_voter_contact(text, boolean) from public, anon;
grant execute on function public.get_my_voter_contact() to authenticated;
grant execute on function public.update_my_voter_contact(text, boolean) to authenticated;
