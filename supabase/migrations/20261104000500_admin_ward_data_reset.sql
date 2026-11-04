create or replace function public.admin_clear_ward_voters(target_ward_number integer)
returns integer language plpgsql security invoker set search_path = '' as $$
declare target_id uuid; removed_count integer;
begin
 if not (select private.is_active_admin()) then raise exception 'केवल सक्रिय एडमिन यह कार्रवाई कर सकता है' using errcode='42501'; end if;
 select id into target_id from public.wards where ward_number=target_ward_number and ward_number between 1 and 7 for update;
 if target_id is null then raise exception 'वार्ड नहीं मिला'; end if;
 delete from public.attendance a using public.voters v where a.voter_id=v.id and v.ward_id=target_id;
 delete from public.voters where ward_id=target_id;
 get diagnostics removed_count=row_count;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values((select auth.uid()),'ward_voters_cleared','ward',target_id::text,jsonb_build_object('ward_number',target_ward_number,'deleted_voters',removed_count));
 return removed_count;
end; $$;
revoke all on function public.admin_clear_ward_voters(integer) from public,anon;
grant execute on function public.admin_clear_ward_voters(integer) to authenticated;