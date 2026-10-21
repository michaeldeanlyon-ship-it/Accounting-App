-- Run with: npx supabase test db   (needs Docker; runs in CI)
begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex@example.com'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam@example.com'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger@example.com');

insert into public.people (id, user_id, display_name, invoice_prefix)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Alex', 'A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Sam', 'S');

insert into public.workspace_members (user_id, person_id)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

insert into public.invoices (id, owner_id, number, client_name, issue_date, due_date, status)
values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '', 'Nordic Lingua AB', '2026-10-01', '2026-10-31', 'draft'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'S-0001', 'Brightsale AB', '2026-10-01', '2026-10-16', 'sent');

-- Anonymous visitors
set local role anon;
select is((select count(*) from public.invoices)::int, 0, 'anonymous visitors see no invoices');
reset role;

-- Signed in, but not part of the workspace
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select is((select count(*) from public.invoices)::int, 0, 'outsiders see no invoices');
select is((select count(*) from public.people)::int, 0, 'outsiders see no people');
select throws_ok(
  $$insert into public.invoices (owner_id, client_name, issue_date, due_date) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'X', '2026-10-01', '2026-10-31')$$,
  '42501', null, 'outsiders cannot create invoices');

-- Alex, a member
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select count(*) from public.invoices)::int, 2, 'a member sees both people''s invoices');
select lives_ok(
  $$update public.invoices set notes = 'Paid by bank transfer' where id = 'b0000000-0000-0000-0000-000000000001'$$,
  'a member can edit the other person''s invoice');
select is(public.next_invoice_number('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'A-0001', 'the first number in a series is 0001');
select is(public.next_invoice_number('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'A-0002', 'numbers follow on without gaps');
select is(public.next_invoice_number('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 'S-0001', 'each person has their own series');
select is(public.send_invoice('a0000000-0000-0000-0000-000000000001'), 'A-0003', 'sending a draft assigns the next number');
select is((select status from public.invoices where id = 'a0000000-0000-0000-0000-000000000001'), 'sent', 'sending marks the invoice as sent');
select throws_ok(
  $$delete from public.invoices where id = 'b0000000-0000-0000-0000-000000000001'$$,
  'P0001', 'Sent invoices cannot be deleted. Issue a credit note instead.', 'sent invoices cannot be deleted');
select throws_ok(
  $$insert into public.time_entries (owner_id, work_date, minutes, note) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-10-20', 0, 'Nothing')$$,
  '23514', null, 'a day needs more than 0 minutes');
reset role;

select is(
  (select count(*) from public.audit_log where row_id = 'b0000000-0000-0000-0000-000000000001')::int, 1,
  'an edit to a sent invoice is written to the audit log');

select * from finish();
rollback;
