-- HAIR IMAGE PREFERRED CONTACT METHOD UPDATE
-- Run this once in Supabase SQL Editor before uploading the website files.

begin;

alter table public.messages
  add column if not exists preferred_contact_method text;

alter table public.messages
  add column if not exists sms_consent boolean not null default false;

alter table public.messages
  drop constraint if exists messages_preferred_contact_method_check;

alter table public.messages
  add constraint messages_preferred_contact_method_check
  check (
    preferred_contact_method is null
    or preferred_contact_method in ('email', 'text', 'call')
  );

alter table public.messages
  drop constraint if exists messages_text_consent_check;

alter table public.messages
  add constraint messages_text_consent_check
  check (
    preferred_contact_method is distinct from 'text'
    or sms_consent = true
  );

grant insert (preferred_contact_method, sms_consent)
on public.messages
to anon, authenticated;

commit;
