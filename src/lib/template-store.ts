import { companies, type CompanyId } from '../data/companies'
import { sanitizeSingleLineText } from './plain-text'
import { getSupabaseBrowserClient } from './supabase'
import type { TemplateRecord } from '../types/template'
import type { TemplateVersionRecord } from '../types/template-version'

type TemplateRow = {
  category: string
  category_id: string | null
  company_id: string
  created_at: string
  id: string
  markup: string
  name: string
  subject: string
  updated_at: string
}

type CategoryRow = {
  company_id: string
  name: string
}

type TemplateVersionRow = {
  category: string
  company_id: string
  created_at: string
  id: string
  markup: string
  name: string
  subject: string
  template_id: string
  version_number: number
}

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function mapTemplateRow(row: TemplateRow): TemplateRecord {
  return {
    category: sanitizeSingleLineText(row.category),
    companyId: isCompanyId(row.company_id) ? row.company_id : 'pcyes',
    createdAt: row.created_at,
    id: row.id,
    markup: row.markup,
    name: sanitizeSingleLineText(row.name),
    subject: sanitizeSingleLineText(row.subject),
    updatedAt: row.updated_at,
  }
}

function mapTemplateVersionRow(row: TemplateVersionRow): TemplateVersionRecord {
  return {
    category: sanitizeSingleLineText(row.category),
    companyId: isCompanyId(row.company_id) ? row.company_id : 'pcyes',
    createdAt: row.created_at,
    id: row.id,
    markup: row.markup,
    name: sanitizeSingleLineText(row.name),
    subject: sanitizeSingleLineText(row.subject),
    templateId: row.template_id,
    versionNumber: row.version_number,
  }
}

async function snapshotTemplateVersion(template: TemplateRecord) {
  const client = getSupabaseBrowserClient()

  const latest = await client
    .from('email_template_versions')
    .select('id, company_id, template_id, version_number, category, name, subject, markup, created_at')
    .eq('template_id', template.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest.error) {
    throw latest.error
  }

  const latestVersion = latest.data ? mapTemplateVersionRow(latest.data as TemplateVersionRow) : null

  if (
    latestVersion &&
    latestVersion.category === template.category &&
    latestVersion.name === template.name &&
    latestVersion.subject === template.subject &&
    latestVersion.markup === template.markup
  ) {
    return latestVersion
  }

  const insertResult = await client
    .from('email_template_versions')
    .insert({
      category: template.category,
      company_id: template.companyId,
      created_at: template.updatedAt,
      markup: template.markup,
      name: template.name,
      subject: template.subject,
      template_id: template.id,
      version_number: (latestVersion?.versionNumber ?? 0) + 1,
    })
    .select('id, company_id, template_id, version_number, category, name, subject, markup, created_at')
    .single()

  if (insertResult.error) {
    throw insertResult.error
  }

  return mapTemplateVersionRow(insertResult.data as TemplateVersionRow)
}

async function ensureCategory(companyId: CompanyId, category: string) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return null
  }

  const categoryName = sanitizeSingleLineText(category)

  if (!categoryName) {
    return null
  }

  const existing = await client
    .from('template_categories')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', categoryName)
    .maybeSingle()

  if (existing.error) {
    throw existing.error
  }

  if (existing.data?.id) {
    return existing.data.id
  }

  const inserted = await client
    .from('template_categories')
    .insert({
      company_id: companyId,
      name: categoryName,
    })
    .select('id')
    .single()

  if (inserted.error) {
    throw inserted.error
  }

  return inserted.data.id
}

export async function loadRemoteWorkspace() {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return {
      categories: [] as CategoryRow[],
      templates: [] as TemplateRecord[],
    }
  }

  const [templatesResult, categoriesResult] = await Promise.all([
    client
      .from('email_templates')
      .select('id, company_id, category_id, category, name, subject, markup, created_at, updated_at')
      .order('updated_at', { ascending: false }),
    client.from('template_categories').select('company_id, name').order('name', { ascending: true }),
  ])

  if (templatesResult.error) {
    throw templatesResult.error
  }

  if (categoriesResult.error) {
    throw categoriesResult.error
  }

  return {
    categories: categoriesResult.data ?? [],
    templates: (templatesResult.data ?? []).map((row) => mapTemplateRow(row as TemplateRow)),
  }
}

export async function saveRemoteTemplate(template: TemplateRecord) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return template
  }

  const categoryId = await ensureCategory(template.companyId, template.category)
  const payload = {
    category: sanitizeSingleLineText(template.category),
    category_id: categoryId,
    company_id: template.companyId,
    created_at: template.createdAt,
    id: template.id,
    markup: template.markup,
    name: sanitizeSingleLineText(template.name),
    subject: sanitizeSingleLineText(template.subject),
    updated_at: template.updatedAt,
  }

  const result = await client
    .from('email_templates')
    .upsert(payload, {
      onConflict: 'id',
    })
    .select('id, company_id, category_id, category, name, subject, markup, created_at, updated_at')
    .single()

  if (result.error) {
    throw result.error
  }

  const saved = mapTemplateRow(result.data as TemplateRow)

  if (saved.markup !== payload.markup) {
    throw new Error('O markup retornado pelo banco nao corresponde ao que foi salvo.')
  }

  await snapshotTemplateVersion(saved)

  return saved
}

export async function deleteRemoteTemplate(id: string, companyId: CompanyId) {
  const client = getSupabaseBrowserClient()
  const result = await client
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id, company_id')
    .maybeSingle()

  if (result.error) {
    throw result.error
  }

  if (!result.data?.id) {
    throw new Error('O template nao foi removido do banco.')
  }

  return {
    companyId: isCompanyId(result.data.company_id) ? result.data.company_id : companyId,
    id: result.data.id,
  }
}

export async function importTemplatesToRemote(templates: TemplateRecord[]) {
  const client = getSupabaseBrowserClient()

  if (!client || templates.length === 0) {
    return []
  }

  const importedTemplates: TemplateRecord[] = []

  for (const template of templates) {
    importedTemplates.push(await saveRemoteTemplate(template))
  }

  return importedTemplates
}

export async function loadTemplateVersions(templateId: string) {
  const client = getSupabaseBrowserClient()

  const result = await client
    .from('email_template_versions')
    .select('id, company_id, template_id, version_number, category, name, subject, markup, created_at')
    .eq('template_id', templateId)
    .order('version_number', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []).map((row) => mapTemplateVersionRow(row as TemplateVersionRow))
}

export function buildCategoryMap(remoteCategories: CategoryRow[], remoteTemplates: TemplateRecord[]) {
  const map = new Map<CompanyId, string[]>()

  for (const company of companies) {
    map.set(company.id, [...company.categories])
  }

  for (const row of remoteCategories) {
    if (!isCompanyId(row.company_id)) {
      continue
    }

    const current = map.get(row.company_id) ?? []

    if (!current.includes(row.name)) {
      current.push(row.name)
      map.set(row.company_id, current)
    }
  }

  for (const template of remoteTemplates) {
    const current = map.get(template.companyId) ?? []

    if (!current.includes(template.category)) {
      current.push(template.category)
      map.set(template.companyId, current)
    }
  }

  return map
}
