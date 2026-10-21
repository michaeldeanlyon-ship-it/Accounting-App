-- Hardening flagged by the Supabase database advisors.

-- Trigger functions run as triggers regardless of EXECUTE rights; nobody should call them over the API.
revoke execute on function public.audit_invoices() from public, anon, authenticated;
revoke execute on function public.audit_invoice_lines() from public, anon, authenticated;

-- Policies only call is_member() for signed-in users.
revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

alter function public.touch_updated_at() set search_path = public;

-- Evaluate auth.uid() and is_member() once per query instead of once per row.
drop policy members_read on public.workspace_members;
create policy members_read on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_member()));
