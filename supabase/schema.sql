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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table if not exists public.company_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, company_id)
);

create or replace function public.is_company_member(target_company_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.company_memberships
    where company_id = target_company_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  );
$$;

create or replace function public.can_access_company(target_company_id text)
returns boolean
language sql
stable
as $$
  select public.is_workspace_admin() or public.is_company_member(target_company_id);
$$;

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

create table if not exists public.email_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.email_templates(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  version_number integer not null,
  category text not null,
  name text not null,
  subject text not null,
  markup text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (template_id, version_number)
);

create table if not exists public.email_sections (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('header', 'footer')),
  name text not null,
  markup text not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.company_brand_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id text not null unique references public.companies(id) on delete cascade,
  logo_url text not null default '',
  primary_color text not null default '',
  secondary_color text not null default '',
  background_color text not null default '',
  typography text not null default '',
  additional_context text not null default '',
  example_markup text not null default '',
  reference_image_data text not null default '',
  reference_image_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.template_variables (
  id text primary key,
  group_id text not null,
  group_label text not null,
  label text not null,
  token text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.template_variables
  drop constraint if exists template_variables_token_key;

alter table public.company_brand_profiles
  add column if not exists logo_url text not null default '';

alter table public.company_brand_profiles
  add column if not exists primary_color text not null default '';

alter table public.company_brand_profiles
  add column if not exists secondary_color text not null default '';

alter table public.company_brand_profiles
  add column if not exists background_color text not null default '';

alter table public.company_brand_profiles
  add column if not exists typography text not null default '';

alter table public.company_brand_profiles
  add column if not exists additional_context text not null default '';

alter table public.company_brand_profiles
  add column if not exists example_markup text not null default '';

alter table public.company_brand_profiles
  add column if not exists reference_image_data text not null default '';

alter table public.company_brand_profiles
  add column if not exists reference_image_name text not null default '';

create index if not exists template_categories_company_id_idx
  on public.template_categories (company_id);

create index if not exists company_memberships_company_id_idx
  on public.company_memberships (company_id);

create index if not exists email_templates_company_id_idx
  on public.email_templates (company_id);

create index if not exists email_templates_updated_at_idx
  on public.email_templates (updated_at desc);

create index if not exists email_template_versions_template_id_idx
  on public.email_template_versions (template_id, version_number desc);

create index if not exists email_template_versions_company_id_idx
  on public.email_template_versions (company_id);

create index if not exists email_sections_company_id_idx
  on public.email_sections (company_id);

create index if not exists company_brand_profiles_company_id_idx
  on public.company_brand_profiles (company_id);

create index if not exists template_variables_group_idx
  on public.template_variables (group_id, sort_order);

create index if not exists template_variables_token_idx
  on public.template_variables (token);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists company_memberships_set_updated_at on public.company_memberships;
create trigger company_memberships_set_updated_at
before update on public.company_memberships
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

drop trigger if exists email_sections_set_updated_at on public.email_sections;
create trigger email_sections_set_updated_at
before update on public.email_sections
for each row
execute function public.set_updated_at();

drop trigger if exists company_brand_profiles_set_updated_at on public.company_brand_profiles;
create trigger company_brand_profiles_set_updated_at
before update on public.company_brand_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists template_variables_set_updated_at on public.template_variables;
create trigger template_variables_set_updated_at
before update on public.template_variables
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
  ),
  (
    'skul',
    'SKUL',
    null,
    jsonb_build_object(
      'bg', '#f4f2f6',
      'border', '#e1d9e6',
      'borderStrong', '#cdbfd8',
      'ink', '#2a1b33',
      'muted', '#6c5b78',
      'primary', '#59008e',
      'primarySoft', '#efe6f6',
      'primaryStrong', '#3c0061',
      'sidebar', '#2f0a46',
      'sidebarBorder', '#3d1254',
      'sidebarMuted', '#bda7cb',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#f8f4fb',
      'surfaceMuted', '#eee7f3'
    )
  ),
  (
    'vinik',
    'VINIK',
    null,
    jsonb_build_object(
      'bg', '#f2faf7',
      'border', '#d7ede6',
      'borderStrong', '#b7ddd2',
      'ink', '#0c2a22',
      'muted', '#4c6f64',
      'primary', '#00b980',
      'primarySoft', '#e5f8f1',
      'primaryStrong', '#00845b',
      'sidebar', '#004c3b',
      'sidebarBorder', '#0b5f4b',
      'sidebarMuted', '#a7d5c6',
      'sidebarText', '#ffffff',
      'surface', '#ffffff',
      'surfaceAlt', '#f6fcfa',
      'surfaceMuted', '#ecf7f3'
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
  ('quati', 'Relacionamento'),
  ('skul', 'Institucional'),
  ('skul', 'Comercial'),
  ('skul', 'Promocional'),
  ('skul', 'Suporte'),
  ('vinik', 'Institucional'),
  ('vinik', 'Comercial'),
  ('vinik', 'Promocional'),
  ('vinik', 'Suporte')
on conflict (company_id, name) do nothing;

insert into public.company_brand_profiles (
  company_id,
  logo_url,
  primary_color,
  secondary_color,
  background_color,
  typography,
  additional_context,
  example_markup,
  reference_image_data,
  reference_image_name
)
select
  companies.id,
  '',
  companies.theme ->> 'primary',
  companies.theme ->> 'primarySoft',
  companies.theme ->> 'bg',
  'Arial, Helvetica, sans-serif',
  coalesce(companies.note, ''),
  '',
  '',
  ''
from public.companies
on conflict (company_id) do update
set
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  background_color = excluded.background_color,
  additional_context = case
    when public.company_brand_profiles.additional_context = '' then excluded.additional_context
    else public.company_brand_profiles.additional_context
  end,
  updated_at = timezone('utc', now());

insert into public.template_variables (
  id,
  group_id,
  group_label,
  label,
  token,
  sort_order
)
values
  ('base-url', 'general', 'GERAL', 'URL Base', '{{config path="web/unsecure/base_url"}}', 10),
  ('secure-base-url', 'general', 'GERAL', 'URL Base Seguro', '{{config path="web/secure/base_url"}}', 20),
  ('store-name', 'general', 'GERAL', 'Nome da loja', '{{config path="general/store_information/name"}}', 30),
  ('store-phone', 'general', 'GERAL', 'Telefone da loja', '{{config path="general/store_information/phone"}}', 40),
  ('store-hours', 'general', 'GERAL', 'Horario da loja', '{{config path="general/store_information/hours"}}', 50),
  ('store-country', 'general', 'GERAL', 'Pais', '{{config path="general/store_information/country_id"}}', 60),
  ('store-region', 'general', 'GERAL', 'Estado/regiao', '{{config path="general/store_information/region_id"}}', 70),
  ('store-postcode', 'general', 'GERAL', 'CEP', '{{config path="general/store_information/postcode"}}', 80),
  ('store-city', 'general', 'GERAL', 'Cidade', '{{config path="general/store_information/city"}}', 90),
  ('store-address-line1', 'general', 'GERAL', 'Endereco linha 1', '{{config path="general/store_information/street_line1"}}', 100),
  ('store-address-line2', 'general', 'GERAL', 'Endereco linha 2', '{{config path="general/store_information/street_line2"}}', 110),
  ('store-address-full', 'general', 'GERAL', 'Endereco completo', '{{config path="general/store_information/address"}}', 120),
  ('store-document', 'general', 'GERAL', 'CPF/CNPJ', '{{config path="general/store_information/merchant_vat_number"}}', 130),
  ('general-name', 'general', 'GERAL', 'Nome do contato geral', '{{config path="trans_email/ident_general/name"}}', 140),
  ('general-email', 'general', 'GERAL', 'E-mail do contato geral', '{{config path="trans_email/ident_general/email"}}', 150),
  ('sales-name', 'general', 'GERAL', 'Nome do representante', '{{config path="trans_email/ident_sales/name"}}', 160),
  ('sales-email', 'general', 'GERAL', 'E-mail do representante', '{{config path="trans_email/ident_sales/email"}}', 170),
  ('support-name', 'general', 'GERAL', 'Nome do suporte', '{{config path="trans_email/ident_support/name"}}', 180),
  ('support-email', 'general', 'GERAL', 'E-mail do suporte', '{{config path="trans_email/ident_support/email"}}', 190),
  ('custom1-name', 'general', 'GERAL', 'Nome personalizado 1', '{{config path="trans_email/ident_custom1/name"}}', 200),
  ('custom1-email', 'general', 'GERAL', 'E-mail personalizado 1', '{{config path="trans_email/ident_custom1/email"}}', 210),
  ('custom2-name', 'general', 'GERAL', 'Nome personalizado 2', '{{config path="trans_email/ident_custom2/name"}}', 220),
  ('custom2-email', 'general', 'GERAL', 'E-mail personalizado 2', '{{config path="trans_email/ident_custom2/email"}}', 230),
  ('logo-url', 'general', 'GERAL', 'Logo URL', '{{var logo_url}}', 240),
  ('logo-alt', 'general', 'GERAL', 'Logo ALT', '{{var logo_alt}}', 250),
  ('logo-width', 'general', 'GERAL', 'Logo largura', '{{var logo_width}}', 260),
  ('logo-height', 'general', 'GERAL', 'Logo altura', '{{var logo_height}}', 270),
  ('template-styles', 'general', 'GERAL', 'Template styles', '{{var template_styles|raw}}', 280),
  ('store-frontend-name', 'general', 'GERAL', 'Nome frontend da loja', '{{var store.frontend_name}}', 290),
  ('store-email', 'general', 'GERAL', 'E-mail da loja', '{{var store_email}}', 300),
  ('store-phone-transport', 'general', 'GERAL', 'Telefone da loja', '{{var store_phone}}', 310),
  ('store-hours-transport', 'general', 'GERAL', 'Horario da loja', '{{var store_hours}}', 320),
  ('store-url', 'general', 'GERAL', 'Store URL', '{{store url=""}}', 330),
  ('custom-var', 'general', 'GERAL', 'Variavel customizada', '{{customvar code="meu_codigo"}}', 340),
  ('order-number', 'order', 'PEDIDO', 'Numero do pedido', '{{var order.increment_id}}', 10),
  ('order-customer-name', 'order', 'PEDIDO', 'Nome do cliente', '{{var order_data.customer_name}}', 20),
  ('order-status', 'order', 'PEDIDO', 'Status do pedido', '{{var order_data.frontend_status_label}}', 30),
  ('order-is-physical', 'order', 'PEDIDO', 'Pedido fisico', '{{var order_data.is_not_virtual}}', 40),
  ('order-note', 'order', 'PEDIDO', 'Nota do cliente', '{{var order_data.email_customer_note}}', 50),
  ('order-created-at', 'order', 'PEDIDO', 'Data formatada', '{{var created_at_formatted}}', 60),
  ('order-shipping-description', 'order', 'PEDIDO', 'Metodo de envio', '{{var order.shipping_description}}', 70),
  ('order-grand-total', 'order', 'PEDIDO', 'Total geral', '{{var order.grand_total}}', 80),
  ('order-currency', 'order', 'PEDIDO', 'Moeda do pedido', '{{var order.order_currency_code}}', 90),
  ('order-billing-address', 'order', 'PEDIDO', 'Endereco de cobranca', '{{var formattedBillingAddress|raw}}', 100),
  ('order-shipping-address', 'order', 'PEDIDO', 'Endereco de entrega', '{{var formattedShippingAddress|raw}}', 110),
  ('order-payment-html', 'order', 'PEDIDO', 'Pagamento HTML', '{{var payment_html|raw}}', 120),
  ('order-shipping-message', 'order', 'PEDIDO', 'Mensagem de envio', '{{var shipping_msg}}', 130),
  ('order-items-layout', 'order', 'PEDIDO', 'Grid de itens', '{{layout handle="sales_email_order_items" order_id=$order_id area="frontend"}}', 140),
  ('order-account-url', 'order', 'PEDIDO', 'URL minha conta', '{{var this.getUrl($store,''customer/account/'',[_nosid:1])}}', 150),
  ('order-comment', 'order', 'PEDIDO', 'Comentario', '{{var comment|escape|nl2br}}', 160),
  ('invoice-number', 'invoice', 'FATURA', 'Numero da fatura', '{{var invoice.increment_id}}', 10),
  ('invoice-id', 'invoice', 'FATURA', 'ID da fatura', '{{var invoice_id}}', 20),
  ('invoice-order-number', 'invoice', 'FATURA', 'Numero do pedido', '{{var order.increment_id}}', 30),
  ('invoice-customer-name', 'invoice', 'FATURA', 'Nome do cliente', '{{var order_data.customer_name}}', 40),
  ('invoice-status', 'invoice', 'FATURA', 'Status do pedido', '{{var order_data.frontend_status_label}}', 50),
  ('invoice-is-physical', 'invoice', 'FATURA', 'Pedido fisico', '{{var order_data.is_not_virtual}}', 60),
  ('invoice-comment', 'invoice', 'FATURA', 'Comentario da fatura', '{{var comment|escape|nl2br}}', 70),
  ('invoice-billing-address', 'invoice', 'FATURA', 'Endereco de cobranca', '{{var formattedBillingAddress|raw}}', 80),
  ('invoice-shipping-address', 'invoice', 'FATURA', 'Endereco de entrega', '{{var formattedShippingAddress|raw}}', 90),
  ('invoice-payment-html', 'invoice', 'FATURA', 'Pagamento HTML', '{{var payment_html|raw}}', 100),
  ('invoice-shipping-description', 'invoice', 'FATURA', 'Metodo de envio', '{{var order.getShippingDescription()}}', 110),
  ('invoice-items-layout', 'invoice', 'FATURA', 'Grid de itens', '{{layout handle="sales_email_order_invoice_items" invoice_id=$invoice_id order_id=$order_id}}', 120),
  ('shipment-number', 'shipment', 'ENVIO', 'Numero do envio', '{{var shipment.increment_id}}', 10),
  ('shipment-id', 'shipment', 'ENVIO', 'ID do envio', '{{var shipment_id}}', 20),
  ('shipment-order-number', 'shipment', 'ENVIO', 'Numero do pedido', '{{var order.increment_id}}', 30),
  ('shipment-customer-name', 'shipment', 'ENVIO', 'Nome do cliente', '{{var order_data.customer_name}}', 40),
  ('shipment-status', 'shipment', 'ENVIO', 'Status do pedido', '{{var order_data.frontend_status_label}}', 50),
  ('shipment-comment', 'shipment', 'ENVIO', 'Comentario do envio', '{{var comment|escape|nl2br}}', 60),
  ('shipment-billing-address', 'shipment', 'ENVIO', 'Endereco de cobranca', '{{var formattedBillingAddress|raw}}', 70),
  ('shipment-shipping-address', 'shipment', 'ENVIO', 'Endereco de entrega', '{{var formattedShippingAddress|raw}}', 80),
  ('shipment-payment-html', 'shipment', 'ENVIO', 'Pagamento HTML', '{{var payment_html|raw}}', 90),
  ('shipment-shipping-description', 'shipment', 'ENVIO', 'Metodo de envio', '{{var order.getShippingDescription()}}', 100),
  ('shipment-items-layout', 'shipment', 'ENVIO', 'Grid de itens', '{{layout handle="sales_email_order_shipment_items" shipment_id=$shipment_id order_id=$order_id}}', 110),
  ('shipment-tracking-block', 'shipment', 'ENVIO', 'Bloco de rastreio', '{{block class=''Magento\Framework\View\Element\Template'' area=''frontend'' template=''Magento_Sales::email/shipment/track.phtml'' shipment=$shipment order=$order}}', 120),
  ('creditmemo-number', 'creditmemo', 'CREDITO', 'Numero da nota', '{{var creditmemo.increment_id}}', 10),
  ('creditmemo-id', 'creditmemo', 'CREDITO', 'ID da nota', '{{var creditmemo_id}}', 20),
  ('creditmemo-order-number', 'creditmemo', 'CREDITO', 'Numero do pedido', '{{var order.increment_id}}', 30),
  ('creditmemo-customer-name', 'creditmemo', 'CREDITO', 'Nome do cliente', '{{var order_data.customer_name}}', 40),
  ('creditmemo-status', 'creditmemo', 'CREDITO', 'Status do pedido', '{{var order_data.frontend_status_label}}', 50),
  ('creditmemo-comment', 'creditmemo', 'CREDITO', 'Comentario da nota', '{{var comment|escape|nl2br}}', 60),
  ('creditmemo-billing-address', 'creditmemo', 'CREDITO', 'Endereco de cobranca', '{{var formattedBillingAddress|raw}}', 70),
  ('creditmemo-shipping-address', 'creditmemo', 'CREDITO', 'Endereco de entrega', '{{var formattedShippingAddress|raw}}', 80),
  ('creditmemo-payment-html', 'creditmemo', 'CREDITO', 'Pagamento HTML', '{{var payment_html|raw}}', 90),
  ('creditmemo-shipping-description', 'creditmemo', 'CREDITO', 'Metodo de envio', '{{var order.getShippingDescription()}}', 100),
  ('creditmemo-items-layout', 'creditmemo', 'CREDITO', 'Grid de itens', '{{layout handle="sales_email_order_creditmemo_items" creditmemo_id=$creditmemo_id order_id=$order_id}}', 110),
  ('customer-name', 'account', 'CONTA', 'Nome completo', '{{var customer.name}}', 10),
  ('customer-email', 'account', 'CONTA', 'E-mail do cliente', '{{var customer.email}}', 20),
  ('customer-firstname', 'account', 'CONTA', 'Primeiro nome', '{{var customer.firstname}}', 30),
  ('customer-lastname', 'account', 'CONTA', 'Sobrenome', '{{var customer.lastname}}', 40),
  ('customer-id', 'account', 'CONTA', 'ID do cliente', '{{var customer.id}}', 50),
  ('customer-prefix', 'account', 'CONTA', 'Prefixo', '{{var customer.prefix}}', 60),
  ('customer-middlename', 'account', 'CONTA', 'Nome do meio', '{{var customer.middlename}}', 70),
  ('customer-suffix', 'account', 'CONTA', 'Sufixo', '{{var customer.suffix}}', 80),
  ('customer-dob', 'account', 'CONTA', 'Data de nascimento', '{{var customer.dob}}', 90),
  ('customer-taxvat', 'account', 'CONTA', 'CPF/CNPJ', '{{var customer.taxvat}}', 100),
  ('customer-gender', 'account', 'CONTA', 'Genero', '{{var customer.gender}}', 110),
  ('customer-group-id', 'account', 'CONTA', 'Grupo do cliente', '{{var customer.group_id}}', 120),
  ('customer-created-in', 'account', 'CONTA', 'Conta criada em', '{{var customer.created_in}}', 130),
  ('customer-store-id', 'account', 'CONTA', 'Store ID', '{{var customer.store_id}}', 140),
  ('account-store-name', 'account', 'CONTA', 'Nome da loja', '{{var store.frontend_name}}', 150),
  ('account-url', 'account', 'CONTA', 'URL minha conta', '{{var this.getUrl($store,''customer/account/'',[_nosid:1])}}', 160),
  ('account-back-url', 'account', 'CONTA', 'URL de confirmacao', '{{var back_url}}', 170),
  ('password-customer-name', 'password', 'SENHA', 'Nome do cliente', '{{var customer.name}}', 10),
  ('password-customer-email', 'password', 'SENHA', 'E-mail do cliente', '{{var customer.email}}', 20),
  ('password-create-url', 'password', 'SENHA', 'URL criar senha', '{{var this.getUrl($store,''customer/account/createPassword/'',[_query:[id:$customer.id,token:$customer.rp_token],_nosid:1])}}', 30),
  ('password-reset-url', 'password', 'SENHA', 'URL redefinir senha', '{{var this.getUrl($store,''customer/account/createPassword/'',[_query:[id:$customer.id,token:$customer.rp_token],_nosid:1])}}', 40),
  ('password-token', 'password', 'SENHA', 'Token da senha', '{{var customer.rp_token}}', 50),
  ('newsletter-confirmation-link', 'newsletter', 'NEWSLETTER', 'Link de confirmacao', '{{var subscriber_data.confirmation_link}}', 10),
  ('newsletter-store-name', 'newsletter', 'NEWSLETTER', 'Nome da loja', '{{var store.frontend_name}}', 20),
  ('rma-number', 'rma', 'RMA', 'Numero do RMA', '{{var rma.increment_id}}', 10),
  ('rma-date-requested', 'rma', 'RMA', 'Data da solicitacao', '{{var rma.date_requested}}', 20),
  ('rma-status', 'rma', 'RMA', 'Status do RMA', '{{var rma.status}}', 30),
  ('rma-status-label', 'rma', 'RMA', 'Status legivel', '{{var status_label}}', 40),
  ('rma-custom-email', 'rma', 'RMA', 'E-mail customizado', '{{var rma.customer_custom_email}}', 50),
  ('rma-order-number', 'rma', 'RMA', 'Numero do pedido', '{{var order.increment_id}}', 60),
  ('rma-customer-name', 'rma', 'RMA', 'Nome do cliente', '{{var customer.name}}', 70),
  ('rma-customer-email', 'rma', 'RMA', 'E-mail do cliente', '{{var customer.email}}', 80),
  ('rma-customer-name-strict', 'rma', 'RMA', 'Nome do cliente strict', '{{var customer_name}}', 90),
  ('rma-comment', 'rma', 'RMA', 'Comentario', '{{var comment}}', 100),
  ('rma-return-address', 'rma', 'RMA', 'Endereco de devolucao', '{{var formattedReturnAddress|raw}}', 110),
  ('rma-url', 'rma', 'RMA', 'URL do RMA', '{{var url}}', 120),
  ('rma-store-name', 'rma', 'RMA', 'Nome da loja', '{{var store.frontend_name}}', 130),
  ('rma-store-phone', 'rma', 'RMA', 'Telefone da loja', '{{var store_phone}}', 140),
  ('rma-store-hours', 'rma', 'RMA', 'Horario da loja', '{{var store_hours}}', 150),
  ('rma-store-email', 'rma', 'RMA', 'E-mail da loja', '{{var store_email}}', 160),
  ('rma-item-collection', 'rma', 'RMA', 'Colecao de itens', '{{var item_collection}}', 170)
on conflict (id) do update
set
  group_id = excluded.group_id,
  group_label = excluded.group_label,
  label = excluded.label,
  token = excluded.token,
  sort_order = excluded.sort_order,
  updated_at = timezone('utc', now());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if split_part(lower(new.email), '@', 2) <> 'oderco.com.br' then
    raise exception 'Somente emails @oderco.com.br podem criar conta';
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    is_admin = (lower(excluded.email) = 'gabriel.barbosa@oderco.com.br'),
    updated_at = timezone('utc', now());

  insert into public.company_memberships (user_id, company_id, role)
  select
    new.id,
    companies.id,
    case
      when lower(new.email) = 'gabriel.barbosa@oderco.com.br' then 'admin'
      else 'member'
    end
  from public.companies
  where lower(new.email) = 'gabriel.barbosa@oderco.com.br'
    or companies.id = 'oderco'
  on conflict (user_id, company_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

update public.profiles
set
  is_admin = (lower(email) = 'gabriel.barbosa@oderco.com.br'),
  updated_at = timezone('utc', now())
where is_admin is distinct from (lower(email) = 'gabriel.barbosa@oderco.com.br');

insert into public.company_memberships (user_id, company_id, role)
select profiles.id, companies.id, 'admin'
from public.profiles
cross join public.companies
where profiles.is_admin = true
on conflict (user_id, company_id) do update
set
  role = excluded.role,
  updated_at = timezone('utc', now());

insert into public.company_memberships (user_id, company_id, role)
select profiles.id, 'oderco', 'member'
from public.profiles
where profiles.is_admin = false
on conflict (user_id, company_id) do nothing;

create or replace function public.list_workspace_access()
returns table (
  user_id uuid,
  email text,
  full_name text,
  is_admin boolean,
  company_ids text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_admin() then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    profiles.id,
    profiles.email,
    profiles.full_name,
    profiles.is_admin,
    coalesce(
      array_agg(company_memberships.company_id order by company_memberships.company_id)
        filter (where company_memberships.company_id is not null),
      '{}'::text[]
    ) as company_ids
  from public.profiles
  left join public.company_memberships
    on company_memberships.user_id = profiles.id
  group by profiles.id, profiles.email, profiles.full_name, profiles.is_admin
  order by profiles.full_name, profiles.email;
end;
$$;

create or replace function public.set_company_membership(
  target_user_id uuid,
  target_company_id text,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_is_admin boolean;
begin
  if not public.is_workspace_admin() then
    raise exception 'Acesso negado';
  end if;

  select is_admin
  into target_is_admin
  from public.profiles
  where id = target_user_id;

  if target_is_admin is null then
    raise exception 'Usuario nao encontrado';
  end if;

  if not exists (
    select 1
    from public.companies
    where id = target_company_id
  ) then
    raise exception 'Empresa nao encontrada';
  end if;

  if target_is_admin then
    raise exception 'Nao altere memberships de usuarios admin por esta tela';
  end if;

  if enabled then
    insert into public.company_memberships (user_id, company_id, role)
    values (target_user_id, target_company_id, 'member')
    on conflict (user_id, company_id) do update
    set
      role = excluded.role,
      updated_at = timezone('utc', now());
  else
    delete from public.company_memberships
    where user_id = target_user_id
      and company_id = target_company_id;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.companies enable row level security;
alter table public.template_categories enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_template_versions enable row level security;
alter table public.email_sections enable row level security;
alter table public.company_brand_profiles enable row level security;
alter table public.template_variables enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles admin read" on public.profiles;
create policy "profiles admin read"
on public.profiles
for select
to authenticated
using (public.is_workspace_admin());

drop policy if exists "profiles self write" on public.profiles;
create policy "profiles self write"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "memberships self read" on public.company_memberships;
create policy "memberships self read"
on public.company_memberships
for select
to authenticated
using (user_id = auth.uid() or public.is_workspace_admin());

drop policy if exists "memberships admin write" on public.company_memberships;
create policy "memberships admin write"
on public.company_memberships
for all
to authenticated
using (public.is_workspace_admin())
with check (public.is_workspace_admin());

drop policy if exists "member companies read" on public.companies;
drop policy if exists "public companies read" on public.companies;
create policy "member companies read"
on public.companies
for select
to authenticated
using (public.can_access_company(id));

drop policy if exists "member categories read" on public.template_categories;
create policy "member categories read"
on public.template_categories
for select
to authenticated
using (public.can_access_company(company_id));

drop policy if exists "member categories write" on public.template_categories;
create policy "member categories write"
on public.template_categories
for all
to authenticated
using (public.can_access_company(company_id))
with check (public.can_access_company(company_id));

drop policy if exists "member templates read" on public.email_templates;
create policy "member templates read"
on public.email_templates
for select
to authenticated
using (public.can_access_company(company_id));

drop policy if exists "member templates write" on public.email_templates;
create policy "member templates write"
on public.email_templates
for all
to authenticated
using (public.can_access_company(company_id))
with check (public.can_access_company(company_id));

drop policy if exists "member template versions read" on public.email_template_versions;
create policy "member template versions read"
on public.email_template_versions
for select
to authenticated
using (public.can_access_company(company_id));

drop policy if exists "member template versions write" on public.email_template_versions;
create policy "member template versions write"
on public.email_template_versions
for all
to authenticated
using (public.can_access_company(company_id))
with check (public.can_access_company(company_id));

drop policy if exists "member sections read" on public.email_sections;
create policy "member sections read"
on public.email_sections
for select
to authenticated
using (public.can_access_company(company_id));

drop policy if exists "member sections write" on public.email_sections;
create policy "member sections write"
on public.email_sections
for all
to authenticated
using (public.can_access_company(company_id))
with check (public.can_access_company(company_id));

drop policy if exists "member brand profiles read" on public.company_brand_profiles;
create policy "member brand profiles read"
on public.company_brand_profiles
for select
to authenticated
using (public.can_access_company(company_id));

drop policy if exists "member brand profiles write" on public.company_brand_profiles;
create policy "member brand profiles write"
on public.company_brand_profiles
for all
to authenticated
using (public.can_access_company(company_id))
with check (public.can_access_company(company_id));

drop policy if exists "workspace variables read" on public.template_variables;
create policy "workspace variables read"
on public.template_variables
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "workspace variables write" on public.template_variables;
create policy "workspace variables write"
on public.template_variables
for all
to authenticated
using (public.is_workspace_admin())
with check (public.is_workspace_admin());

comment on table public.companies is
  'Empresas/projetos do E-mail Lab com tema visual e nota opcional.';

comment on table public.template_categories is
  'Categorias disponiveis por empresa.';

comment on table public.email_templates is
  'Templates de email do E-mail Lab. Defina auth e policies antes de liberar escrita pelo browser.';

comment on table public.email_template_versions is
  'Snapshots versionados de cada template para historico e restauracao.';

comment on table public.email_sections is
  'Secoes reutilizaveis de header e footer por empresa, com favorito para uso rapido e IA.';

comment on table public.company_brand_profiles is
  'Contexto de identidade visual por empresa para apoiar criacao manual e geracao com IA.';

comment on table public.template_variables is
  'Catalogo compartilhado de variaveis Magento usadas nos templates do E-mail Lab.';

comment on table public.profiles is
  'Perfil basico do usuario autenticado no E-mail Lab.';

comment on table public.company_memberships is
  'Quais empresas cada usuario autenticado pode acessar.';
