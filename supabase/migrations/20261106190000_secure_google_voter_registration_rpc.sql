create or replace function public.register_google_voter(p_full_name text, p_voter_ids text[])
returns jsonb language plpgsql security definer set search_path = public, auth
as $$
declare
 v_user_id uuid := auth.uid(); v_ids text[]; v_count integer; v_matches integer; v_voter record; v_index integer := 0;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_full_name,''))) < 2 then raise exception 'पूरा नाम सही भरें'; end if;
 select array_agg(distinct upper(trim(x))) into v_ids from unnest(coalesce(p_voter_ids,array[]::text[])) x where trim(x)<>'';
 if coalesce(array_length(v_ids,1),0)=0 then raise exception 'कम से कम एक मतदाता पहचान संख्या जरूरी है'; end if;
 if exists(select 1 from public.profiles where user_id=v_user_id) then return jsonb_build_object('status','existing_profile'); end if;
 select count(*) into v_count from unnest(v_ids);
 select count(*) into v_matches from public.voters v where upper(trim(v.voter_id))=any(v_ids);
 if v_matches<>v_count then raise exception 'दी गई एक या अधिक मतदाता पहचान संख्या सूची में नहीं मिली'; end if;
 if exists(select 1 from public.voters v join public.voter_account_links l on l.voter_id=v.id where upper(trim(v.voter_id))=any(v_ids)) then raise exception 'इस मतदाता रिकॉर्ड का अकाउंट पहले से जुड़ा है। एडमिन से संपर्क करें।'; end if;
 insert into public.profiles(user_id,full_name,role,is_active) values(v_user_id,trim(p_full_name),'voter',false);
 for v_voter in select v.id from public.voters v where upper(trim(v.voter_id))=any(v_ids) order by array_position(v_ids,upper(trim(v.voter_id))) loop
  v_index:=v_index+1;
  insert into public.voter_account_links(user_id,voter_id,relation) values(v_user_id,v_voter.id,case when v_index=1 then 'self' else 'family_member' end);
 end loop;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(v_user_id,'google_voter_registration','profile',v_user_id::text,jsonb_build_object('voter_ids',v_ids,'status','pending_admin_approval'));
 return jsonb_build_object('status','pending_admin_approval','linked_count',v_index);
end; $$;
revoke all on function public.register_google_voter(text,text[]) from public,anon;
grant execute on function public.register_google_voter(text,text[]) to authenticated;
