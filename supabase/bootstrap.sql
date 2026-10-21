-- One-time setup after the migration has run.
-- 1. In Supabase → Authentication → Users, add both people (email + password).
-- 2. Replace the names, emails and details below, then run this in the SQL editor.

with alex as (
  insert into public.people (
    user_id, display_name, role_title, work_style, color, business_name, email,
    vat_registered, vat_period, invoice_prefix, hourly_rate, payment_terms_days
  )
  select id, 'Alex', 'Translator', 'hourly', '#7c3aed', 'Alex Översättning', email,
         true, 'quarterly', 'A', 65000, 30
    from auth.users where email = 'translator@example.com'
  returning id, user_id
), sam as (
  insert into public.people (
    user_id, display_name, role_title, work_style, color, business_name, email,
    vat_registered, invoice_prefix, base_fee, commission_percent, payment_terms_days
  )
  select id, 'Sam', 'Sales contractor', 'base_commission', '#0d9488', 'Sam Sales Consulting', email,
         false, 'S', 1000000, 5, 15
    from auth.users where email = 'sales@example.com'
  returning id, user_id
)
insert into public.workspace_members (user_id, person_id)
select user_id, id from alex
union all
select user_id, id from sam;

-- Everything else (org number, VAT number, bank details, rates, next invoice number)
-- can be filled in on the Settings page.
