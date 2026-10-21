-- The VAT choice new invoices start with. Services to a company outside the EU are 'export':
-- the place of supply is outside Sweden, so no Swedish moms and not counted towards the 120,000 kr limit.
alter table public.people
  add column default_vat_treatment text not null default 'exempt'
  check (default_vat_treatment in ('domestic', 'eu_reverse_charge', 'export', 'exempt'));

update public.people set default_vat_treatment = 'domestic' where vat_registered;
