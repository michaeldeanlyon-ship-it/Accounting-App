-- Each person has a usual VAT choice for new invoices (e.g. 'export' for a client in the USA).
begin;
select plan(3);

select has_column('public', 'people', 'default_vat_treatment', 'people have a usual VAT choice');
select col_default_is('public', 'people', 'default_vat_treatment', 'exempt'::text, 'defaults to momsbefriad');
select throws_ok(
  $$insert into public.people (display_name, default_vat_treatment) values ('Bad', 'somewhere')$$,
  '23514', null, 'only known VAT choices are allowed');

select * from finish();
rollback;
