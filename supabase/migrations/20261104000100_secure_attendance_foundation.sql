-- WardWise Voter Compass: secure attendance foundation
-- Stores attendance only; never stores candidate/party choice.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'staff' check (role in ('admin','staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wards (
  id uuid primary key default gen_random_uuid(),
  ward_number integer not null unique check (ward_number > 0),
  name text not null,
  booth text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ward_assignments (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  ward_id uuid not null references public.wards(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, ward_id)
);

create table if not exists public.voters (
  id uuid primary key default gen_random_uuid(),
  voter_id text not null unique,
  full_name text not null,
  relative_name text,
  age integer check (age is null or age between 18 and 120),
  gender text check (gender is null or gender in ('पुरुष','महिला','अन्य')),
  house_number text,
  ward_id uuid not null references public.wards(id),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null unique references public.voters(id),
  recorded_by uuid not null references public.profiles(user_id),
  recorded_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(user_id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists voters_ward_id_idx on public.voters(ward_id);
create index if not exists attendance_recorded_at_idx on public.attendance(recorded_at desc);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'admin' and p.is_active = true
  );
$$;

create or replace function private.has_active_ward(target_ward uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.ward_assignments wa on wa.user_id = p.user_id
    join public.wards w on w.id = wa.ward_id
    where p.user_id = (select auth.uid())
      and p.is_active = true and w.is_active = true
      and wa.ward_id = target_ward
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_active_admin() to authenticated;
grant execute on function private.has_active_ward(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.wards enable row level security;
alter table public.ward_assignments enable row level security;
alter table public.voters enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_read_self_or_admin" on public.profiles
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_active_admin()));
create policy "profiles_admin_manage" on public.profiles
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy "wards_read_assigned_or_admin" on public.wards
for select to authenticated
using ((select private.is_active_admin()) or (is_active and (select private.has_active_ward(id))));
create policy "wards_admin_manage" on public.wards
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy "assignments_read_self_or_admin" on public.ward_assignments
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_active_admin()));
create policy "assignments_admin_manage" on public.ward_assignments
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy "voters_read_assigned_or_admin" on public.voters
for select to authenticated
using ((select private.is_active_admin()) or (select private.has_active_ward(ward_id)));
create policy "voters_admin_manage" on public.voters
for all to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

create policy "attendance_read_assigned_or_admin" on public.attendance
for select to authenticated
using (
  (select private.is_active_admin())
  or exists (
    select 1 from public.voters v
    where v.id = attendance.voter_id
      and (select private.has_active_ward(v.ward_id))
  )
);
create policy "attendance_insert_assigned_self_or_admin" on public.attendance
for insert to authenticated
with check (
  recorded_by = (select auth.uid())
  and (
    (select private.is_active_admin())
    or exists (
      select 1 from public.voters v
      where v.id = attendance.voter_id
        and (select private.has_active_ward(v.ward_id))
    )
  )
);
create policy "attendance_admin_delete" on public.attendance
for delete to authenticated
using ((select private.is_active_admin()));

create policy "audit_admin_read" on public.audit_logs
for select to authenticated
using ((select private.is_active_admin()));

create or replace function private.log_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    new.recorded_by,
    'attendance_recorded',
    'voter',
    new.voter_id::text,
    jsonb_build_object('attendance_id', new.id, 'recorded_at', new.recorded_at)
  );
  return new;
end;
$$;

drop trigger if exists attendance_audit_insert on public.attendance;
create trigger attendance_audit_insert
after insert on public.attendance
for each row execute function private.log_attendance_insert();

revoke all on public.profiles, public.wards, public.ward_assignments,
  public.voters, public.attendance, public.audit_logs from anon;
grant select, insert, update, delete on public.profiles, public.wards,
  public.ward_assignments, public.voters, public.attendance, public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;
