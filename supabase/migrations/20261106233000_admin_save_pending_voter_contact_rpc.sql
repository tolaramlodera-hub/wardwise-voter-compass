create or replace function public.admin_save_pending_voter_contact(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_submission public.pending_voter_contact_submissions%rowtype;
begin
  if not private.is_active_admin() then
    raise exception 'केवल सक्रिय एडमिन यह कार्रवाई कर सकता है';
  end if;
  select * into v_submission from public.pending_voter_contact_submissions where user_id = p_user_id;
  if not found then raise exception 'मतदाता का मोबाइल नंबर/सहमति रिकॉर्ड नहीं मिला'; end if;
  if not exists (select 1 from public.voter_account_links where user_id = p_user_id) then
    raise exception 'इस अकाउंट से मतदाता रिकॉर्ड लिंक नहीं है';
  end if;
  insert into public.voter_contacts(voter_id,phone,consent_to_event_contact,consent_recorded_at,updated_by,updated_at)
  select l.voter_id,v_submission.phone,v_submission.consent_to_event_contact,
         case when v_submission.consent_to_event_contact then v_submission.submitted_at else null end,
         auth.uid(),now()
  from public.voter_account_links l where l.user_id=p_user_id
  on conflict (voter_id) do update set phone=excluded.phone,
    consent_to_event_contact=excluded.consent_to_event_contact,
    consent_recorded_at=excluded.consent_recorded_at,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  update public.pending_voter_contact_submissions set reviewed_at=now(),reviewed_by=auth.uid() where user_id=p_user_id;
end;
$$;
revoke all on function public.admin_save_pending_voter_contact(uuid) from public,anon;
grant execute on function public.admin_save_pending_voter_contact(uuid) to authenticated;