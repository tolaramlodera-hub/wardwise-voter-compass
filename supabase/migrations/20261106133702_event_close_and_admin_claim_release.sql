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
