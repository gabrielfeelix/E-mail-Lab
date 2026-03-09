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

create table if not exists public.companies (
  id text primary key,
  name text not null,
  note text,
  theme jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.template_categories (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name)
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  category_id uuid references public.template_categories(id) on delete set null,
  category text not null,
  name text not null,
  subject text not null,
  markup text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists template_categories_company_id_idx
  on public.template_categories (company_id);

create index if not exists email_templates_company_id_idx
  on public.email_templates (company_id);

create index if not exists email_templates_updated_at_idx
  on public.email_templates (updated_at desc);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists template_categories_set_updated_at on public.template_categories;
create trigger template_categories_set_updated_at
before update on public.template_categories
for each row
execute function public.set_updated_at();

drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at
before update on public.email_templates
for each row
execute function public.set_updated_at();

insert into public.companies (id, name, note, theme)
values
  (
    'pcyes',
    'PCYES',
    'Primaria inferida a partir do logo vermelho atual.',
    jsonb_build_object(
      'bg', '#f4f5f7',
      'border', '#dadada',
      'borderStrong', '#bdbdbd',
      'ink', '#111111',
      'muted', '#6f6f6f',
      'primary', '#c91818',
      'primarySoft', '#f5e9e9',
      'primaryStrong', '#8e0f0f',
      'sidebar', '#000000',
      'sidebarBorder', '#1f1f1f',
      'sidebarMuted', '#9b9b9b',
      'sidebarText', '#f7f7f7',
      'surface', '#ffffff',
      'surfaceAlt', '#f7f7f7',
      'surfaceMuted', '#efefef'
    )
  ),
  (
    'oderco',
    'ODERCO',
    null,
    jsonb_build_object(
      'bg', '#ffffff',
      'border', '#d8e2f5',
      'borderStrong', '#bdd0f0',
      'ink', '#0d1d52',
      'muted', '#53658f',
      'primary', '#0d1d52',
      'primarySoft', '#e5efff',
      'primaryStrong', '#09133a',
      'sidebar', '#0d1d52',
      'sidebarBorder', '#182a67',
      'sidebarMuted', '#b6c7ec',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#f7faff',
      'surfaceMuted', '#edf3ff'
    )
  ),
  (
    'azux',
    'AZUX',
    null,
    jsonb_build_object(
      'bg', '#f4f8fc',
      'border', '#d2e6f0',
      'borderStrong', '#b5d5e7',
      'ink', '#0e2746',
      'muted', '#53718e',
      'primary', '#0256a3',
      'primarySoft', '#e6f3fb',
      'primaryStrong', '#013b71',
      'sidebar', '#0256a3',
      'sidebarBorder', '#0b66b4',
      'sidebarMuted', '#b7d8ea',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#f7fbfe',
      'surfaceMuted', '#ebf6fb'
    )
  ),
  (
    'crm',
    'CRM',
    null,
    jsonb_build_object(
      'bg', '#f5f5f5',
      'border', '#d8dde5',
      'borderStrong', '#c1cad7',
      'ink', '#001233',
      'muted', '#5e6777',
      'primary', '#001233',
      'primarySoft', '#e8edf5',
      'primaryStrong', '#000b1f',
      'sidebar', '#001233',
      'sidebarBorder', '#102146',
      'sidebarMuted', '#9ea9c0',
      'sidebarText', '#f5f5f5',
      'surface', '#ffffff',
      'surfaceAlt', '#fafafa',
      'surfaceMuted', '#f0f2f5'
    )
  ),
  (
    'odex',
    'ODEX',
    null,
    jsonb_build_object(
      'bg', '#f6f8ff',
      'border', '#d7def7',
      'borderStrong', '#c2cdf2',
      'ink', '#0d1d52',
      'muted', '#536087',
      'primary', '#0d1d52',
      'primarySoft', '#e8efff',
      'primaryStrong', '#081238',
      'sidebar', '#0d1d52',
      'sidebarBorder', '#1a2c66',
      'sidebarMuted', '#b8c6eb',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#f8faff',
      'surfaceMuted', '#eef3ff'
    )
  ),
  (
    'tonante',
    'TONANTE',
    null,
    jsonb_build_object(
      'bg', '#ffffff',
      'border', '#d6d6d6',
      'borderStrong', '#bfbfbf',
      'ink', '#111111',
      'muted', '#5e5e5e',
      'primary', '#111111',
      'primarySoft', '#f0f0f0',
      'primaryStrong', '#000000',
      'sidebar', '#000000',
      'sidebarBorder', '#191919',
      'sidebarMuted', '#bdbdbd',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#f7f7f7',
      'surfaceMuted', '#f0f0f0'
    )
  ),
  (
    'quati',
    'QUATI',
    null,
    jsonb_build_object(
      'bg', '#f8fbf1',
      'border', '#dce8c8',
      'borderStrong', '#cadcaf',
      'ink', '#24310f',
      'muted', '#66724b',
      'primary', '#7fc21f',
      'primarySoft', '#edf8d6',
      'primaryStrong', '#5e9612',
      'sidebar', '#6ba319',
      'sidebarBorder', '#79b81d',
      'sidebarMuted', '#d6edaf',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#fbfdf7',
      'surfaceMuted', '#f2f8e7'
    )
  )
on conflict (id) do update
set
  name = excluded.name,
  note = excluded.note,
  theme = excluded.theme,
  updated_at = timezone('utc', now());

insert into public.template_categories (company_id, name)
values
  ('pcyes', 'Institucional'),
  ('pcyes', 'Newsletter'),
  ('pcyes', 'Promocional'),
  ('pcyes', 'Lancamento'),
  ('pcyes', 'Suporte'),
  ('oderco', 'Institucional'),
  ('oderco', 'Comercial'),
  ('oderco', 'Cobranca'),
  ('oderco', 'Onboarding'),
  ('oderco', 'Suporte'),
  ('azux', 'Newsletter'),
  ('azux', 'Produtos'),
  ('azux', 'Suporte'),
  ('azux', 'Comunicado'),
  ('crm', 'CRM'),
  ('crm', 'Fluxo'),
  ('crm', 'Reativacao'),
  ('crm', 'Relacionamento'),
  ('odex', 'Institucional'),
  ('odex', 'Produto'),
  ('odex', 'Operacional'),
  ('odex', 'Suporte'),
  ('tonante', 'Institucional'),
  ('tonante', 'Campanha'),
  ('tonante', 'Evento'),
  ('tonante', 'Comunicado'),
  ('quati', 'Institucional'),
  ('quati', 'Promocao'),
  ('quati', 'Lancamento'),
  ('quati', 'Relacionamento')
on conflict (company_id, name) do nothing;

alter table public.companies enable row level security;
alter table public.template_categories enable row level security;
alter table public.email_templates enable row level security;

drop policy if exists "public companies read" on public.companies;
create policy "public companies read"
on public.companies
for select
to anon, authenticated
using (true);

drop policy if exists "public categories read" on public.template_categories;
create policy "public categories read"
on public.template_categories
for select
to anon, authenticated
using (true);

drop policy if exists "public categories write" on public.template_categories;
create policy "public categories write"
on public.template_categories
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public templates read" on public.email_templates;
create policy "public templates read"
on public.email_templates
for select
to anon, authenticated
using (true);

drop policy if exists "public templates write" on public.email_templates;
create policy "public templates write"
on public.email_templates
for all
to anon, authenticated
using (true)
with check (true);

comment on table public.companies is
  'Empresas/projetos do E-mail Lab com tema visual e nota opcional.';

comment on table public.template_categories is
  'Categorias disponiveis por empresa.';

comment on table public.email_templates is
  'Templates de email do E-mail Lab. Defina auth e policies antes de liberar escrita pelo browser.';
