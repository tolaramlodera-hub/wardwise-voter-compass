-- Tighten inherited database function exposure and index foreign keys.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
create index if not exists attendance_recorded_by_idx on public.attendance(recorded_by);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists ward_assignments_ward_id_idx on public.ward_assignments(ward_id);
