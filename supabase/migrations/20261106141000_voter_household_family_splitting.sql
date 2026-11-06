alter table public.voters
  add column if not exists family_group uuid,
  add column if not exists family_label text;

create index if not exists voters_household_lookup_idx
  on public.voters (ward_id, house_number, family_group);

create or replace function public.split_voter_household(
  p_voter_ids uuid[],
  p_family_label text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.voters%rowtype;
  v_new_group uuid := gen_random_uuid();
  v_selected_count integer;
  v_total_count integer;
begin
  if not private.is_active_admin() then
    raise exception 'Admin only';
  end if;
  if coalesce(cardinality(p_voter_ids), 0) < 1 then
    raise exception 'Select family members';
  end if;
  if nullif(btrim(p_family_label), '') is null then
    raise exception 'Family name required';
  end if;
  select * into v_source from public.voters where id = p_voter_ids[1] for update;
  if not found or nullif(btrim(v_source.house_number), '') is null then
    raise exception 'Household not found or house number missing';
  end if;
  select count(*) into v_selected_count from public.voters v
  where v.id = any(p_voter_ids) and v.ward_id = v_source.ward_id
    and v.house_number = v_source.house_number
    and v.family_group is not distinct from v_source.family_group;
  select count(*) into v_total_count from public.voters v
  where v.ward_id = v_source.ward_id and v.house_number = v_source.house_number
    and v.family_group is not distinct from v_source.family_group;
  if v_selected_count <> cardinality(p_voter_ids) then
    raise exception 'Selected voters must belong to the same family';
  end if;
  if v_selected_count >= v_total_count then
    raise exception 'Keep at least one member in the original family';
  end if;
  update public.voters set family_group = v_new_group, family_label = btrim(p_family_label)
  where id = any(p_voter_ids);
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'voter_household_split', 'voter_household',
    v_source.ward_id::text || ':' || v_source.house_number,
    jsonb_build_object('new_family_group', v_new_group, 'family_label', btrim(p_family_label),
      'member_ids', p_voter_ids, 'member_count', v_selected_count));
  return v_new_group;
end;
$$;
revoke all on function public.split_voter_household(uuid[], text) from public;
grant execute on function public.split_voter_household(uuid[], text) to authenticated;
