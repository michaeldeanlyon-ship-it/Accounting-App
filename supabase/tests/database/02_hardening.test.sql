-- Security hardening flagged by the Supabase database advisors.
begin;
select plan(7);

select ok(not has_function_privilege('anon', 'public.audit_invoices()', 'execute'), 'visitors cannot call the invoice audit trigger');
select ok(not has_function_privilege('authenticated', 'public.audit_invoices()', 'execute'), 'signed-in users cannot call the invoice audit trigger directly');
select ok(not has_function_privilege('anon', 'public.audit_invoice_lines()', 'execute'), 'visitors cannot call the line audit trigger');
select ok(not has_function_privilege('authenticated', 'public.audit_invoice_lines()', 'execute'), 'signed-in users cannot call the line audit trigger directly');
select ok(not has_function_privilege('anon', 'public.is_member()', 'execute'), 'visitors cannot call is_member');
select ok(
  (select coalesce(array_to_string(proconfig, ','), '') from pg_proc where proname = 'touch_updated_at') like '%search_path=%',
  'touch_updated_at runs with a fixed search_path');
select ok(
  (select qual from pg_policies where tablename = 'workspace_members' and policyname = 'members_read') ilike '%select auth.uid()%',
  'workspace_members checks the login once per query');

select * from finish();
rollback;
