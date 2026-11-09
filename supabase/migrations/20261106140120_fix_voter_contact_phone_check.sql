alter table public.voter_contacts
  drop constraint if exists voter_contacts_phone_check;

alter table public.voter_contacts
  add constraint voter_contacts_phone_check
  check (phone ~ '^[+]?[0-9][0-9 -]{7,17}$');
