create or replace function public.admin_link_pending_voter(p_user_id uuid, p_voter_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_voter public.voters%rowtype;
begin
  if not private.is_active_admin() then
    raise exception 'केवल सक्रिय Admin मतदाता रिकॉर्ड लिंक कर सकता है';
  end if;

  select * into v_profile
  from public.profiles
  where user_id = p_user_id
  for update;

  if not found or v_profile.role <> 'voter' or v_profile.is_active then
    raise exception 'यह लंबित मतदाता अकाउंट उपलब्ध नहीं है';
  end if;

  select * into v_voter
  from public.voters
  where id = p_voter_record_id;

  if not found then
    raise exception 'चुना गया मतदाता रिकॉर्ड सूची में नहीं मिला';
  end if;

  if exists (
    select 1 from public.voter_account_links
    where voter_id = p_voter_record_id and user_id <> p_user_id
  ) then
    raise exception 'यह मतदाता रिकॉर्ड पहले से किसी दूसरे अकाउंट से जुड़ा है';
  end if;

  insert into public.voter_account_links(user_id, voter_id, relation)
  values (p_user_id, p_voter_record_id, 'self')
  on conflict (user_id, voter_id) do nothing;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'admin_link_pending_voter',
    'profile',
    p_user_id::text,
    jsonb_build_object('voter_record_id', p_voter_record_id, 'voter_id', v_voter.voter_id, 'voter_name', v_voter.full_name)
  );

  return jsonb_build_object('linked', true, 'voter_name', v_voter.full_name, 'voter_id', v_voter.voter_id);
end;
$$;

revoke all on function public.admin_link_pending_voter(uuid, uuid) from public, anon;
grant execute on function public.admin_link_pending_voter(uuid, uuid) to authenticated;
