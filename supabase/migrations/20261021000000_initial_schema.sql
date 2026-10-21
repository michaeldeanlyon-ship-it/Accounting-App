-- Ledger: schema for two freelancers sharing one workspace.
-- Money columns are bigint minor units (öre/cents). Tax amounts (kronor) are int. Durations are int minutes.

------------------------------------------------------------------------------------------------
-- People and workspace membership
------------------------------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  display_name text not null,
  role_title text not null default '',
  work_style text not null default 'hourly' check (work_style in ('hourly', 'base_commission')),
  color text not null default '#0f766e',
  business_name text not null default '',
  org_number text not null default '',
  address text not null default '',
  email text not null default '',
  phone text not null default '',
  vat_registered boolean not null default false,
  vat_number text not null default '',
  vat_period text not null default 'quarterly' check (vat_period in ('monthly', 'quarterly', 'yearly')),
  accounting_method text not null default 'cash' check (accounting_method in ('cash', 'invoice')),
  municipal_rate numeric(5, 2) not null default 32.38,
  birth_year int not null default 1985,
  employment_income int not null default 0,
  monthly_fskatt int not null default 0,
  has_occupational_pension boolean not null default false,
  housing text not null default 'apartment' check (housing in ('house', 'apartment')),
  bankgiro text not null default '',
  iban text not null default '',
  bic text not null default '',
  invoice_prefix text not null default 'F',
  next_invoice_number int not null default 1 check (next_invoice_number > 0),
  payment_terms_days int not null default 30 check (payment_terms_days >= 0),
  hourly_rate bigint not null default 0,
  base_fee bigint not null default 0,
  commission_percent numeric(6, 3) not null default 0,
  default_client_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Security definer so policies can call it without recursing into workspace_members' own policy.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workspace_members where user_id = auth.uid())
$$;

------------------------------------------------------------------------------------------------
-- Clients, projects, invoices
------------------------------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete cascade,
  name text not null,
  org_number text not null default '',
  vat_number text not null default '',
  country text not null default 'SE' check (char_length(country) = 2),
  is_business boolean not null default true,
  address text not null default '',
  email text not null default '',
  currency text not null default 'SEK' check (char_length(currency) = 3),
  payment_terms_days int not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  hourly_rate bigint not null default 0,
  currency text not null default 'SEK' check (char_length(currency) = 3),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete restrict,
  -- Empty while a draft; the gapless number is assigned when the invoice is sent.
  number text not null default '',
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null default '',
  client_address text not null default '',
  client_org_number text not null default '',
  client_vat_number text not null default '',
  issue_date date not null,
  due_date date not null,
  currency text not null default 'SEK' check (char_length(currency) = 3),
  fx_rate_to_sek numeric(12, 6) not null default 1 check (fx_rate_to_sek > 0),
  vat_treatment text not null default 'domestic' check (vat_treatment in ('domestic', 'eu_reverse_charge', 'export', 'exempt')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'credited')),
  paid_date date,
  paid_amount bigint,
  credits_invoice_id uuid references public.invoices (id) on delete restrict,
  notes text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invoices_owner_number_key on public.invoices (owner_id, number) where number <> '';
create index invoices_due_date_idx on public.invoices (due_date);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('time', 'fixed', 'commission')),
  description text not null default '',
  vat_rate numeric(5, 2) not null default 25,
  work_date date,
  minutes int,
  hourly_rate bigint,
  quantity numeric(14, 4),
  unit text,
  unit_price bigint,
  sales_base bigint,
  percent numeric(7, 3),
  time_entry_id uuid
);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  work_date date not null,
  minutes int not null check (minutes > 0 and minutes <= 1440),
  note text not null default '',
  invoice_id uuid references public.invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_owner_date_idx on public.time_entries (owner_id, work_date);

------------------------------------------------------------------------------------------------
-- Expenses, deductions, tax
------------------------------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete cascade,
  expense_date date not null,
  supplier text not null,
  category text not null default 'other',
  amount_gross bigint not null check (amount_gross >= 0),
  vat_amount bigint not null default 0 check (vat_amount >= 0),
  currency text not null default 'SEK' check (char_length(currency) = 3),
  fx_rate_to_sek numeric(12, 6) not null default 1 check (fx_rate_to_sek > 0),
  deductible_percent numeric(5, 2) not null default 100 check (deductible_percent between 0 and 100),
  receipt_path text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deductions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete cascade,
  year int not null,
  type text not null check (type in ('home_office', 'mileage', 'other')),
  amount int not null check (amount >= 0),
  distance_mil numeric(10, 1),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.people (id) on delete cascade,
  payment_date date not null,
  amount int not null,
  type text not null check (type in ('f_skatt', 'moms', 'restskatt')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.tax_year_params (
  year int primary key,
  params jsonb not null,
  updated_at timestamptz not null default now()
);

------------------------------------------------------------------------------------------------
-- Audit log (Bokföringslagen: changes to sent invoices must be traceable)
------------------------------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  invoice_id uuid,
  action text not null,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);
create index audit_log_invoice_idx on public.audit_log (invoice_id);

create or replace function public.audit_invoices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Sent invoices cannot be deleted. Issue a credit note instead.';
    end if;
    return old;
  end if;
  if old.status <> 'draft' then
    insert into public.audit_log (table_name, row_id, invoice_id, action, old_row, new_row)
    values ('invoices', new.id, new.id, 'update', to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

create trigger invoices_audit
before update or delete on public.invoices
for each row execute function public.audit_invoices();

create or replace function public.audit_invoice_lines()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice uuid;
  v_status text;
begin
  v_invoice := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;
  select status into v_status from public.invoices where id = v_invoice;
  if v_status is not null and v_status <> 'draft' then
    insert into public.audit_log (table_name, row_id, invoice_id, action, old_row, new_row)
    values (
      'invoice_lines',
      case when tg_op = 'DELETE' then old.id else new.id end,
      v_invoice,
      lower(tg_op),
      case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      case when tg_op = 'DELETE' then null else to_jsonb(new) end
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger invoice_lines_audit
after insert or update or delete on public.invoice_lines
for each row execute function public.audit_invoice_lines();

------------------------------------------------------------------------------------------------
-- updated_at
------------------------------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger people_touch before update on public.people for each row execute function public.touch_updated_at();
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();
create trigger time_entries_touch before update on public.time_entries for each row execute function public.touch_updated_at();
create trigger expenses_touch before update on public.expenses for each row execute function public.touch_updated_at();

------------------------------------------------------------------------------------------------
-- Invoice numbering and saving
------------------------------------------------------------------------------------------------
-- Takes the next number in a person's series. The row lock on people makes it gapless under concurrency.
create or replace function public.next_invoice_number(p_owner uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prefix text;
  v_number int;
begin
  update public.people
     set next_invoice_number = next_invoice_number + 1
   where id = p_owner
  returning invoice_prefix, next_invoice_number - 1 into v_prefix, v_number;
  if v_number is null then
    raise exception 'Unknown person %', p_owner;
  end if;
  return v_prefix || '-' || lpad(v_number::text, 4, '0');
end;
$$;

-- Numbers a draft and marks it sent in one transaction, so a failed send never burns a number.
create or replace function public.send_invoice(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
  v_status text;
  v_number text;
begin
  select owner_id, status, number into v_owner, v_status, v_number
    from public.invoices where id = p_id for update;
  if v_owner is null then
    raise exception 'Invoice not found';
  end if;
  if v_status <> 'draft' then
    return v_number;
  end if;
  v_number := public.next_invoice_number(v_owner);
  update public.invoices set number = v_number, status = 'sent' where id = p_id;
  return v_number;
end;
$$;

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
    credits_invoice_id, notes
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
    credits_invoice_id = excluded.credits_invoice_id,
    notes = excluded.notes
  where (i.number, i.client_id, i.client_name, i.client_address, i.client_org_number, i.client_vat_number,
         i.issue_date, i.due_date, i.currency, i.fx_rate_to_sek, i.vat_treatment, i.status, i.paid_date,
         i.paid_amount, i.credits_invoice_id, i.notes)
    is distinct from
        (excluded.number, excluded.client_id, excluded.client_name, excluded.client_address, excluded.client_org_number,
         excluded.client_vat_number, excluded.issue_date, excluded.due_date, excluded.currency, excluded.fx_rate_to_sek,
         excluded.vat_treatment, excluded.status, excluded.paid_date, excluded.paid_amount, excluded.credits_invoice_id,
         excluded.notes);

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

------------------------------------------------------------------------------------------------
-- Row level security: any workspace member can read and write everything
------------------------------------------------------------------------------------------------
alter table public.people enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.time_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.deductions enable row level security;
alter table public.tax_payments enable row level security;
alter table public.tax_year_params enable row level security;
alter table public.audit_log enable row level security;

create policy members_all on public.people for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_read on public.workspace_members for select to authenticated using (user_id = auth.uid() or public.is_member());
create policy members_all on public.clients for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.projects for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.invoices for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.invoice_lines for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.time_entries for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.expenses for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.deductions for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.tax_payments for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_all on public.tax_year_params for all to authenticated using (public.is_member()) with check (public.is_member());
create policy members_read on public.audit_log for select to authenticated using (public.is_member());

------------------------------------------------------------------------------------------------
-- Receipts storage (private bucket)
------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

create policy receipts_members on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and public.is_member())
  with check (bucket_id = 'receipts' and public.is_member());

------------------------------------------------------------------------------------------------
-- Seed: 2026 tax rates (verify against Skatteverket every January; editable in the app)
------------------------------------------------------------------------------------------------
insert into public.tax_year_params (year, params) values (2026, '{
  "year": 2026, "pbb": 59200, "ibb": 83400,
  "egenavgiftRate": 0.2897, "egenavgiftRateSenior": 0.1021,
  "egenavgiftReductionRate": 0.075, "egenavgiftReductionMax": 15000,
  "schablonavdragRate": 0.25, "stateTaxRate": 0.2, "stateTaxThreshold": 643000,
  "jobbskatteavdrag": {"band1": 0.91, "band2": 3.24, "band3": 8.08, "base2": 0.91, "rate2": 0.3874, "base3": 1.813, "rate3": 0.251, "max": 3.027},
  "periodiseringsfondRate": 0.3, "pensionDeductionRate": 0.35, "pensionDeductionMaxIbb": 10,
  "specialPayrollTaxPension": 0.2426, "homeOfficeHouse": 2000, "homeOfficeApartment": 4000,
  "mileagePerMil": 25, "vatExemptionThreshold": 120000, "expansionsfondRate": 0.206, "defaultMunicipalRate": 32.38
}'::jsonb) on conflict (year) do nothing;
