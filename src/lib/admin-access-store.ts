import { companies, type CompanyId } from '../data/companies'
import { getSupabaseBrowserClient } from './supabase'
import type { AdminAccessRecord } from '../types/admin-access'

type AdminAccessRow = {
  company_ids: string[] | null
  email: string
  full_name: string
  is_admin: boolean
  user_id: string
}

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function mapRow(row: AdminAccessRow): AdminAccessRecord {
  return {
    companyIds: (row.company_ids ?? []).filter(isCompanyId),
    email: row.email,
    fullName: row.full_name,
    isAdmin: Boolean(row.is_admin),
    userId: row.user_id,
  }
}

export async function loadWorkspaceAccess() {
  const client = getSupabaseBrowserClient()

  const result = await client.rpc('list_workspace_access')
  if (result.error) {
    throw result.error
  }

  return (result.data ?? []).map((row: unknown) => mapRow(row as AdminAccessRow))
}

export async function setWorkspaceCompanyAccess(userId: string, companyId: CompanyId, enabled: boolean) {
  const client = getSupabaseBrowserClient()

  const result = await client.rpc('set_company_membership', {
    enabled,
    target_company_id: companyId,
    target_user_id: userId,
  })

  if (result.error) {
    throw result.error
  }
}
