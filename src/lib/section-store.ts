import { companies, type CompanyId } from '../data/companies'
import { getSupabaseBrowserClient } from './supabase'
import type { SectionKind, SectionRecord } from '../types/section'

type SectionRow = {
  company_id: string
  created_at: string
  id: string
  is_favorite: boolean
  kind: SectionKind
  markup: string
  name: string
  updated_at: string
}

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function mapSectionRow(row: SectionRow): SectionRecord {
  return {
    companyId: isCompanyId(row.company_id) ? row.company_id : 'pcyes',
    createdAt: row.created_at,
    id: row.id,
    isFavorite: row.is_favorite,
    kind: row.kind,
    markup: row.markup,
    name: row.name,
    updatedAt: row.updated_at,
  }
}

async function clearFavorite(kind: SectionKind, companyId: CompanyId, ignoreId?: string) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return
  }

  let query = client
    .from('email_sections')
    .update({ is_favorite: false })
    .eq('company_id', companyId)
    .eq('kind', kind)
    .eq('is_favorite', true)

  if (ignoreId) {
    query = query.neq('id', ignoreId)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }
}

export async function loadRemoteSections(companyId?: CompanyId) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return [] as SectionRecord[]
  }

  let query = client
    .from('email_sections')
    .select('id, company_id, kind, name, markup, is_favorite, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const result = await query

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []).map((row) => mapSectionRow(row as SectionRow))
}

export async function saveRemoteSection(section: SectionRecord) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return section
  }

  if (section.isFavorite) {
    await clearFavorite(section.kind, section.companyId, section.id)
  }

  const result = await client
    .from('email_sections')
    .upsert(
      {
        company_id: section.companyId,
        created_at: section.createdAt,
        id: section.id,
        is_favorite: section.isFavorite,
        kind: section.kind,
        markup: section.markup,
        name: section.name.trim(),
        updated_at: section.updatedAt,
      },
      { onConflict: 'id' },
    )
    .select('id, company_id, kind, name, markup, is_favorite, created_at, updated_at')
    .single()

  if (result.error) {
    throw result.error
  }

  return mapSectionRow(result.data as SectionRow)
}

export async function deleteRemoteSection(id: string) {
  const client = getSupabaseBrowserClient()

  if (!client) {
    return
  }

  const result = await client.from('email_sections').delete().eq('id', id)

  if (result.error) {
    throw result.error
  }
}
