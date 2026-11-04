-- Configure ward numbers 1 through 7 without creating any voter records.
insert into public.wards (ward_number, name, booth, is_active)
select n, 'वार्ड ' || n::text, null, true
from generate_series(2, 7) as n
on conflict (ward_number) do update set is_active = true;
