-- Additive event calling foundation. Does not alter existing voter or attendance rows.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array['admin','staff','voter']));

create table if not exists public.voter_contacts (
 voter_id uuid primary key references public.voters(id) on delete cascade,
 phone text not null check (phone ~ '^\+?[0-9][0-9 -]{7,17}$'),
 consent_to_event_contact boolean not null default false,
 consent_recorded_at timestamptz,
 updated_by uuid references public.profiles(user_id),
 updated_at timestamptz not null default now()
);
create table if not exists public.community_events (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 120),
 purpose text not null, event_at timestamptz not null, place text not null, details text not null default '',
 created_by uuid not null references public.profiles(user_id), organizer_id uuid references public.profiles(user_id),
 status text not null default 'pending' check(status in ('pending','approved','rejected','closed')),
 reviewed_by uuid references public.profiles(user_id), reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.event_members (
 event_id uuid not null references public.community_events(id) on delete cascade,
 user_id uuid not null references public.profiles(user_id) on delete cascade,
 member_role text not null default 'caller' check(member_role in ('organizer','caller')),
 is_active boolean not null default true, appointed_by uuid references public.profiles(user_id),
 appointed_at timestamptz not null default now(), primary key(event_id,user_id)
);
create table if not exists public.event_households (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.community_events(id) on delete cascade,
 ward_id uuid not null references public.wards(id), house_number text not null, household_label text not null default '',
 voter_ids uuid[] not null default '{}',
 status text not null default 'pending' check(status in ('pending','retry','completed','needs_correction')),
 completed_at timestamptz, completed_by uuid references public.profiles(user_id), created_at timestamptz not null default now(),
 unique(event_id,ward_id,house_number,household_label)
);
create table if not exists public.event_call_claims (
 household_id uuid primary key references public.event_households(id) on delete cascade,
 caller_id uuid not null references public.profiles(user_id), claimed_at timestamptz not null default now(), expires_at timestamptz not null
);
create table if not exists public.event_calling_records (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.event_households(id) on delete cascade,
 caller_id uuid not null references public.profiles(user_id),
 outcome text not null check(outcome in ('contacted','no_answer','busy','call_later','invalid_number')),
 notes text not null default '', created_at timestamptz not null default now()
);
create index if not exists event_households_event_status_idx on public.event_households(event_id,status);
create index if not exists event_call_records_household_created_idx on public.event_calling_records(household_id,created_at desc);

create or replace function public.is_event_member(p_event_id uuid) returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.event_members m where m.event_id=p_event_id and m.user_id=auth.uid() and m.is_active) $$;
create or replace function public.is_active_admin() returns boolean
language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.role='admin' and p.is_active) $$;

alter table public.voter_contacts enable row level security;
alter table public.community_events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_households enable row level security;
alter table public.event_call_claims enable row level security;
alter table public.event_calling_records enable row level security;

drop policy if exists "admins manage voter contacts" on public.voter_contacts;
create policy "admins manage voter contacts" on public.voter_contacts for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
drop policy if exists "event members read consented contacts" on public.voter_contacts;
create policy "event members read consented contacts" on public.voter_contacts for select to authenticated using(consent_to_event_contact and exists(select 1 from public.event_households h where voter_id=any(h.voter_ids) and public.is_event_member(h.event_id)));
drop policy if exists "event applicants and admins read events" on public.community_events;
create policy "event applicants and admins read events" on public.community_events for select to authenticated using(public.is_active_admin() or created_by=auth.uid() or public.is_event_member(id));
drop policy if exists "active users request events" on public.community_events;
create policy "active users request events" on public.community_events for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.is_active));
drop policy if exists "admins review events" on public.community_events;
create policy "admins review events" on public.community_events for update to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
drop policy if exists "members and admins read event team" on public.event_members;
create policy "members and admins read event team" on public.event_members for select to authenticated using(public.is_active_admin() or user_id=auth.uid() or public.is_event_member(event_id));
drop policy if exists "organizers manage event team" on public.event_members;
create policy "organizers manage event team" on public.event_members for all to authenticated using(public.is_active_admin() or exists(select 1 from public.community_events e where e.id=event_id and e.organizer_id=auth.uid() and e.status='approved')) with check(public.is_active_admin() or exists(select 1 from public.community_events e where e.id=event_id and e.organizer_id=auth.uid() and e.status='approved'));
drop policy if exists "event members read households" on public.event_households;
create policy "event members read households" on public.event_households for select to authenticated using(public.is_active_admin() or public.is_event_member(event_id));
drop policy if exists "admins manage households" on public.event_households;
create policy "admins manage households" on public.event_households for all to authenticated using(public.is_active_admin()) with check(public.is_active_admin());
drop policy if exists "event members read claims" on public.event_call_claims;
create policy "event members read claims" on public.event_call_claims for select to authenticated using(public.is_active_admin() or caller_id=auth.uid() or exists(select 1 from public.event_households h where h.id=household_id and public.is_event_member(h.event_id)));
drop policy if exists "callers read call history" on public.event_calling_records;
create policy "callers read call history" on public.event_calling_records for select to authenticated using(public.is_active_admin() or caller_id=auth.uid() or exists(select 1 from public.event_households h where h.id=household_id and public.is_event_member(h.event_id)));

create or replace function public.claim_event_household(p_household_id uuid,p_lock_minutes integer default 10)
returns table(ok boolean,locked_by uuid,expires_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_event uuid; v_status text; v_exp timestamptz;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_lock_minutes<1 or p_lock_minutes>30 then raise exception 'Lock duration must be 1-30 minutes'; end if;
 select event_id,status into v_event,v_status from public.event_households where id=p_household_id;
 if v_event is null or v_status not in ('pending','retry') then raise exception 'Household is not available'; end if;
 if not public.is_active_admin() and not public.is_event_member(v_event) then raise exception 'Not an event caller'; end if;
 if not exists(select 1 from public.community_events e where e.id=v_event and e.status='approved') then raise exception 'Event is not approved'; end if;
 insert into public.event_call_claims(household_id,caller_id,expires_at) values(p_household_id,auth.uid(),now()+make_interval(mins=>p_lock_minutes))
 on conflict(household_id) do update set caller_id=excluded.caller_id,claimed_at=now(),expires_at=excluded.expires_at
 where public.event_call_claims.expires_at<now() or public.event_call_claims.caller_id=auth.uid();
 select c.caller_id,c.expires_at into locked_by,v_exp from public.event_call_claims c where c.household_id=p_household_id;
 ok:=locked_by=auth.uid(); expires_at:=v_exp; return next;
end $$;

create or replace function public.submit_event_call(p_household_id uuid,p_outcome text,p_notes text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_event uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_outcome not in ('contacted','no_answer','busy','call_later','invalid_number') then raise exception 'Invalid outcome'; end if;
 if not exists(select 1 from public.event_call_claims c where c.household_id=p_household_id and c.caller_id=auth.uid() and c.expires_at>now()) then raise exception 'Active household lock required'; end if;
 select event_id into v_event from public.event_households where id=p_household_id;
 if not public.is_active_admin() and not public.is_event_member(v_event) then raise exception 'Not an event caller'; end if;
 insert into public.event_calling_records(household_id,caller_id,outcome,notes) values(p_household_id,auth.uid(),p_outcome,left(coalesce(p_notes,''),1000)) returning id into v_id;
 update public.event_households set status=case when p_outcome='contacted' then 'completed' when p_outcome='invalid_number' then 'needs_correction' else 'retry' end,
 completed_at=case when p_outcome='contacted' then now() else null end,completed_by=case when p_outcome='contacted' then auth.uid() else null end where id=p_household_id;
 delete from public.event_call_claims where household_id=p_household_id and caller_id=auth.uid(); return v_id;
end $$;

create or replace function public.correct_event_household_status(p_household_id uuid,p_status text,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_active_admin() then raise exception 'Admin only'; end if;
 if p_status not in ('pending','retry','completed','needs_correction') then raise exception 'Invalid status'; end if;
 update public.event_households set status=p_status,completed_at=case when p_status='completed' then coalesce(completed_at,now()) else null end,
 completed_by=case when p_status='completed' then auth.uid() else null end where id=p_household_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'event_household_status_corrected','event_household',p_household_id::text,jsonb_build_object('status',p_status,'reason',left(coalesce(p_reason,''),500)));
 delete from public.event_call_claims where household_id=p_household_id;
end $$;
revoke all on function public.claim_event_household(uuid,integer) from public;
revoke all on function public.submit_event_call(uuid,text,text) from public;
revoke all on function public.correct_event_household_status(uuid,text,text) from public;
grant execute on function public.claim_event_household(uuid,integer) to authenticated;
grant execute on function public.submit_event_call(uuid,text,text) to authenticated;
grant execute on function public.correct_event_household_status(uuid,text,text) to authenticated;
