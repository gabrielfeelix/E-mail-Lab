create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  category text not null,
  name text not null,
  subject text not null,
  markup text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists email_templates_company_id_idx
  on public.email_templates (company_id);

create index if not exists email_templates_updated_at_idx
  on public.email_templates (updated_at desc);

drop trigger if exists email_templates_set_updated_at on public.email_templates;

create trigger email_templates_set_updated_at
before update on public.email_templates
for each row
execute function public.set_updated_at();

alter table public.email_templates enable row level security;

comment on table public.email_templates is
  'Starter table for E-mail Lab templates. Define auth and policies before opening browser writes.';
