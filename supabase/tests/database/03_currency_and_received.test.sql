-- Invoices in another currency record the SEK that actually arrived; day lines can carry time only.
begin;
select plan(5);

select has_column('public', 'people', 'default_currency', 'people have a usual invoice currency');
select has_column('public', 'invoices', 'paid_amount_sek', 'invoices record the SEK received');

insert into public.people (id, display_name, invoice_prefix, default_currency)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test', 'T', 'USD');

select public.save_invoice(
  '{"id":"c0000000-0000-0000-0000-000000000001","owner_id":"cccccccc-cccc-cccc-cccc-cccccccccccc","number":"","client_name":"US client",
    "issue_date":"2026-10-21","due_date":"2026-11-05","currency":"USD","fx_rate_to_sek":10.4,"vat_treatment":"exempt","status":"sent",
    "paid_date":"2026-10-30","paid_amount":100000,"paid_amount_sek":1032500,"notes":""}'::jsonb,
  '[{"id":"c0000000-0000-0000-0000-000000000002","kind":"time","description":"Mon 19 Oct","vat_rate":0,"work_date":"2026-10-19","minutes":390,"hourly_rate":null},
    {"id":"c0000000-0000-0000-0000-000000000003","kind":"fixed","description":"Translation services","vat_rate":0,"quantity":1,"unit":"st","unit_price":100000}]'::jsonb);

select is((select paid_amount_sek from public.invoices where id = 'c0000000-0000-0000-0000-000000000001'), 1032500::bigint, 'save_invoice stores the SEK received');
select is((select hourly_rate from public.invoice_lines where id = 'c0000000-0000-0000-0000-000000000002'), null::bigint, 'a day line can have no hourly rate');
select is((select default_currency from public.people where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 'USD', 'the usual currency is stored');

select * from finish();
rollback;
