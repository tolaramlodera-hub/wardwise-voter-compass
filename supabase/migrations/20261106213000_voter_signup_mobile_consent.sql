create table if not exists public.pending_voter_contact_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null,
  consent_to_event_contact boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
alter table public.pending_voter_contact_submissions enable row level security;
drop policy if exists pending_voter_contact_admin_read on public.pending_voter_contact_submissions;
create policy pending_voter_contact_admin_read on public.pending_voter_contact_submissions
for select to authenticated using (private.is_active_admin());
drop policy if exists pending_voter_contact_admin_write on public.pending_voter_contact_submissions;
create policy pending_voter_contact_admin_write on public.pending_voter_contact_submissions
for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());

create or replace function public.register_google_voter(
  p_full_name text, p_voter_ids text[], p_phone text, p_consent_to_event_contact boolean
) returns jsonb
language plpgsql security definer set search_path = public, auth
as $$
declare
 v_user_id uuid := auth.uid();
 v_ids text[];
 v_count integer;
 v_matches integer;
 v_voter record;
 v_index integer := 0;
 v_phone text := regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g');
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_full_name,''))) < 2 then raise exception 'पूरा नाम सही भरें'; end if;
 if length(regexp_replace(v_phone,'[^0-9]','','g')) not in (10,12) then raise exception '10 अंकों का सही मोबाइल नंबर भरें'; end if;
 select array_agg(distinct upper(trim(x))) into v_ids from unnest(coalesce(p_voter_ids,array[]::text[])) x where trim(x)<>'';
 if coalesce(array_length(v_ids,1),0)=0 then raise exception 'कम से कम एक मतदाता पहचान संख्या जरूरी है'; end if;
 if exists(select 1 from public.profiles where user_id=v_user_id) then raise exception 'इस Google अकाउंट का रजिस्ट्रेशन पहले से मौजूद है'; end if;
 select count(*) into v_count from unnest(v_ids);
 select count(*) into v_matches from public.voters v where upper(trim(v.voter_id))=any(v_ids);
 if v_matches<>v_count then raise exception 'दी गई एक या अधिक मतदाता पहचान संख्या सूची में नहीं मिली'; end if;
 if exists(select 1 from public.voters v join public.voter_account_links l on l.voter_id=v.id where upper(trim(v.voter_id))=any(v_ids)) then
   raise exception 'इस मतदाता रिकॉर्ड का अकाउंट पहले से जुड़ा है। एडमिन से संपर्क करें।';
 end if;
 insert into public.profiles(user_id,full_name,role,is_active) values(v_user_id,trim(p_full_name),'voter',false);
 for v_voter in select v.id from public.voters v where upper(trim(v.voter_id))=any(v_ids) order by array_position(v_ids,upper(trim(v.voter_id))) loop
  v_index:=v_index+1;
  insert into public.voter_account_links(user_id,voter_id,relation) values(v_user_id,v_voter.id,case when v_index=1 then 'self' else 'family_member' end);
 end loop;
 insert into public.pending_voter_contact_submissions(user_id,phone,consent_to_event_contact)
 values(v_user_id,v_phone,coalesce(p_consent_to_event_contact,false));
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(v_user_id,'google_voter_registration','profile',v_user_id::text,
 jsonb_build_object('voter_ids',v_ids,'status','pending_admin_approval','phone_submitted',true,'contact_consent',coalesce(p_consent_to_event_contact,false)));
 return jsonb_build_object('status','pending_admin_approval','linked_count',v_index);
end; $$;

revoke all on function public.register_google_voter(text,text[]) from public, anon, authenticated;
revoke all on function public.register_google_voter(text,text[],text,boolean) from public, anon;
grant execute on function public.register_google_voter(text,text[],text,boolean) to authenticated;
