import { companies, type CompanyId } from '../data/companies'
import { getSupabaseBrowserClient } from './supabase'
import type { TemplateRecord } from '../types/template'

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

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function mapTemplateRow(row: TemplateRow): TemplateRecord {
  return {
    category: row.category,
    companyId: isCompanyId(row.company_id) ? row.company_id : 'pcyes',
    createdAt: row.created_at,
    id: row.id,
    markup: row.markup,
    name: row.name,
    subject: row.subject,
    updatedAt: row.updated_at,
  }
}

async function ensureCategory(companyId: CompanyId, category: string) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return null
  }

  const categoryName = category.trim()

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
    category: template.category.trim(),
    category_id: categoryId,
    company_id: template.companyId,
    created_at: template.createdAt,
    id: template.id,
    markup: template.markup,
    name: template.name.trim(),
    subject: template.subject.trim(),
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

  return mapTemplateRow(result.data as TemplateRow)
}

export async function deleteRemoteTemplate(id: string) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return
  }

  const result = await client.from('email_templates').delete().eq('id', id)

  if (result.error) {
    throw result.error
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
