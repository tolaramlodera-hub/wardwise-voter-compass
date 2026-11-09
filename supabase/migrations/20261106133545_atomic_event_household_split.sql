create or replace function public.split_event_household(p_source_household uuid,p_member_ids uuid[],p_family_label text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_source public.event_households%rowtype; v_new_id uuid;
begin
 if not public.is_active_admin() then raise exception 'Admin only'; end if;
 select * into v_source from public.event_households where id=p_source_household for update;
 if not found then raise exception 'Household not found'; end if;
 if coalesce(cardinality(p_member_ids),0)<1 or coalesce(cardinality(p_member_ids),0)>=cardinality(v_source.voter_ids) then raise exception 'Select some, but not all, household members'; end if;
 if not (p_member_ids <@ v_source.voter_ids) then raise exception 'Selected members do not belong to this household'; end if;
 if nullif(trim(p_family_label),'') is null then raise exception 'Family label required'; end if;
 update public.event_households set voter_ids=array(select x from unnest(v_source.voter_ids) x where not (x=any(p_member_ids))) where id=p_source_household;
 insert into public.event_households(event_id,ward_id,house_number,household_label,voter_ids,status)
 values(v_source.event_id,v_source.ward_id,v_source.house_number,trim(p_family_label),p_member_ids,'pending') returning id into v_new_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(auth.uid(),'event_household_split','event_household',p_source_household::text,jsonb_build_object('new_household_id',v_new_id,'member_count',cardinality(p_member_ids),'family_label',trim(p_family_label)));
 return v_new_id;
end $$;
revoke all on function public.split_event_household(uuid,uuid[],text) from public;
grant execute on function public.split_event_household(uuid,uuid[],text) to authenticated;
