create or replace function public.submit_event_call(p_household_id uuid,p_outcome text,p_notes text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_event uuid; v_status text; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_outcome not in ('contacted','no_answer','busy','call_later','invalid_number') then raise exception 'Invalid outcome'; end if;
 select h.event_id,e.status into v_event,v_status from public.event_households h join public.community_events e on e.id=h.event_id where h.id=p_household_id;
 if v_status <> 'approved' then raise exception 'Event is not active for calling'; end if;
 if not exists(select 1 from public.event_call_claims c where c.household_id=p_household_id and c.caller_id=auth.uid() and c.expires_at>now()) then raise exception 'Active household lock required'; end if;
 if not public.is_active_admin() and not public.is_event_member(v_event) then raise exception 'Not an event caller'; end if;
 insert into public.event_calling_records(household_id,caller_id,outcome,notes) values(p_household_id,auth.uid(),p_outcome,left(coalesce(p_notes,''),1000)) returning id into v_id;
 update public.event_households set status=case when p_outcome='contacted' then 'completed' when p_outcome='invalid_number' then 'needs_correction' else 'retry' end,
 completed_at=case when p_outcome='contacted' then now() else null end,completed_by=case when p_outcome='contacted' then auth.uid() else null end where id=p_household_id;
 delete from public.event_call_claims where household_id=p_household_id and caller_id=auth.uid();
 return v_id;
end $$;
create or replace function public.release_event_household_claim(p_household_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_active_admin() then raise exception 'Admin only'; end if;
 delete from public.event_call_claims where household_id=p_household_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(auth.uid(),'event_household_claim_released','event_household',p_household_id::text,'{}'::jsonb);
end $$;
revoke all on function public.release_event_household_claim(uuid) from public;
grant execute on function public.release_event_household_claim(uuid) to authenticated;
