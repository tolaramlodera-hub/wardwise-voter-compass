alter table public.voters
  add column if not exists serial_no integer;

create unique index if not exists voters_ward_serial_no_uidx
  on public.voters (ward_id, serial_no)
  where serial_no is not null;

comment on column public.voters.serial_no is
  'Original serial number from the official ward electoral roll; preserve source order.';
