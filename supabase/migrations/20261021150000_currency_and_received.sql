-- Invoices in another currency (e.g. USD): the usual currency per person, and the SEK that actually
-- reached the bank when an invoice is paid. Under kontantmetoden that SEK amount is the income.

alter table public.people
  add column default_currency text not null default 'SEK' check (char_length(default_currency) = 3);

alter table public.invoices
  add column paid_amount_sek bigint check (paid_amount_sek is null or paid_amount_sek >= 0);

-- Saves an invoice and its lines in one transaction.
create or replace function public.save_invoice(p_invoice jsonb, p_lines jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := coalesce(nullif(p_invoice ->> 'id', '')::uuid, gen_random_uuid());
begin
  insert into public.invoices as i (
    id, owner_id, number, client_id, client_name, client_address, client_org_number, client_vat_number,
    issue_date, due_date, currency, fx_rate_to_sek, vat_treatment, status, paid_date, paid_amount,
    paid_amount_sek, credits_invoice_id, notes
  ) values (
    v_id,
    (p_invoice ->> 'owner_id')::uuid,
    coalesce(p_invoice ->> 'number', ''),
    nullif(p_invoice ->> 'client_id', '')::uuid,
    coalesce(p_invoice ->> 'client_name', ''),
    coalesce(p_invoice ->> 'client_address', ''),
    coalesce(p_invoice ->> 'client_org_number', ''),
    coalesce(p_invoice ->> 'client_vat_number', ''),
    (p_invoice ->> 'issue_date')::date,
    (p_invoice ->> 'due_date')::date,
    coalesce(p_invoice ->> 'currency', 'SEK'),
    coalesce((p_invoice ->> 'fx_rate_to_sek')::numeric, 1),
    coalesce(p_invoice ->> 'vat_treatment', 'domestic'),
    coalesce(p_invoice ->> 'status', 'draft'),
    nullif(p_invoice ->> 'paid_date', '')::date,
    (p_invoice ->> 'paid_amount')::bigint,
    (p_invoice ->> 'paid_amount_sek')::bigint,
    nullif(p_invoice ->> 'credits_invoice_id', '')::uuid,
    coalesce(p_invoice ->> 'notes', '')
  )
  on conflict (id) do update set
    number = excluded.number,
    client_id = excluded.client_id,
    client_name = excluded.client_name,
    client_address = excluded.client_address,
    client_org_number = excluded.client_org_number,
    client_vat_number = excluded.client_vat_number,
    issue_date = excluded.issue_date,
    due_date = excluded.due_date,
    currency = excluded.currency,
    fx_rate_to_sek = excluded.fx_rate_to_sek,
    vat_treatment = excluded.vat_treatment,
    status = excluded.status,
    paid_date = excluded.paid_date,
    paid_amount = excluded.paid_amount,
    paid_amount_sek = excluded.paid_amount_sek,
    credits_invoice_id = excluded.credits_invoice_id,
    notes = excluded.notes
  where (i.number, i.client_id, i.client_name, i.client_address, i.client_org_number, i.client_vat_number,
         i.issue_date, i.due_date, i.currency, i.fx_rate_to_sek, i.vat_treatment, i.status, i.paid_date,
         i.paid_amount, i.paid_amount_sek, i.credits_invoice_id, i.notes)
    is distinct from
        (excluded.number, excluded.client_id, excluded.client_name, excluded.client_address, excluded.client_org_number,
         excluded.client_vat_number, excluded.issue_date, excluded.due_date, excluded.currency, excluded.fx_rate_to_sek,
         excluded.vat_treatment, excluded.status, excluded.paid_date, excluded.paid_amount, excluded.paid_amount_sek,
         excluded.credits_invoice_id, excluded.notes);

  delete from public.invoice_lines
   where invoice_id = v_id
     and not (id = any (array(select (l ->> 'id')::uuid from jsonb_array_elements(p_lines) as l)));

  insert into public.invoice_lines as il (
    id, invoice_id, position, kind, description, vat_rate, work_date, minutes, hourly_rate,
    quantity, unit, unit_price, sales_base, percent, time_entry_id
  )
  select
    (l ->> 'id')::uuid, v_id, (t.pos - 1)::int, l ->> 'kind', coalesce(l ->> 'description', ''),
    coalesce((l ->> 'vat_rate')::numeric, 0), nullif(l ->> 'work_date', '')::date, (l ->> 'minutes')::int,
    (l ->> 'hourly_rate')::bigint, (l ->> 'quantity')::numeric, l ->> 'unit', (l ->> 'unit_price')::bigint,
    (l ->> 'sales_base')::bigint, (l ->> 'percent')::numeric, nullif(l ->> 'time_entry_id', '')::uuid
  from jsonb_array_elements(p_lines) with ordinality as t (l, pos)
  on conflict (id) do update set
    position = excluded.position,
    kind = excluded.kind,
    description = excluded.description,
    vat_rate = excluded.vat_rate,
    work_date = excluded.work_date,
    minutes = excluded.minutes,
    hourly_rate = excluded.hourly_rate,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    sales_base = excluded.sales_base,
    percent = excluded.percent,
    time_entry_id = excluded.time_entry_id
  where (il.position, il.kind, il.description, il.vat_rate, il.work_date, il.minutes, il.hourly_rate, il.quantity,
         il.unit, il.unit_price, il.sales_base, il.percent, il.time_entry_id)
    is distinct from
        (excluded.position, excluded.kind, excluded.description, excluded.vat_rate, excluded.work_date, excluded.minutes,
         excluded.hourly_rate, excluded.quantity, excluded.unit, excluded.unit_price, excluded.sales_base,
         excluded.percent, excluded.time_entry_id);

  return v_id;
end;
$$;
