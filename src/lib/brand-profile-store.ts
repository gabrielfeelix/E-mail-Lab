import { companies, type CompanyId } from '../data/companies'
import { getSupabaseBrowserClient } from './supabase'
import type { BrandProfileRecord } from '../types/brand-profile'

type BrandProfileRow = {
  additional_context: string
  background_color: string
  company_id: string
  created_at: string
  example_markup: string
  id: string
  logo_url: string
  primary_color: string
  reference_image_data: string
  reference_image_name: string
  secondary_color: string
  typography: string
  updated_at: string
}

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function mapBrandProfileRow(row: BrandProfileRow): BrandProfileRecord {
  return {
    additionalContext: row.additional_context,
    backgroundColor: row.background_color,
    companyId: isCompanyId(row.company_id) ? row.company_id : 'pcyes',
    createdAt: row.created_at,
    exampleMarkup: row.example_markup,
    id: row.id,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    referenceImageData: row.reference_image_data,
    referenceImageName: row.reference_image_name,
    secondaryColor: row.secondary_color,
    typography: row.typography,
    updatedAt: row.updated_at,
  }
}

export async function loadRemoteBrandProfiles() {
  const client = getSupabaseBrowserClient()
  const result = await client
    .from('company_brand_profiles')
    .select(
      'id, company_id, logo_url, primary_color, secondary_color, background_color, typography, additional_context, example_markup, reference_image_data, reference_image_name, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })

  if (result.error) {
    throw result.error
  }

  return (result.data ?? []).map((row) => mapBrandProfileRow(row as BrandProfileRow))
}

export async function saveRemoteBrandProfile(profile: BrandProfileRecord) {
  const client = getSupabaseBrowserClient()
  const result = await client
    .from('company_brand_profiles')
    .upsert(
      {
        additional_context: profile.additionalContext,
        background_color: profile.backgroundColor,
        company_id: profile.companyId,
        created_at: profile.createdAt,
        example_markup: profile.exampleMarkup,
        id: profile.id,
        logo_url: profile.logoUrl,
        primary_color: profile.primaryColor,
        reference_image_data: profile.referenceImageData,
        reference_image_name: profile.referenceImageName,
        secondary_color: profile.secondaryColor,
        typography: profile.typography,
        updated_at: profile.updatedAt,
      },
      { onConflict: 'company_id' },
    )
    .select(
      'id, company_id, logo_url, primary_color, secondary_color, background_color, typography, additional_context, example_markup, reference_image_data, reference_image_name, created_at, updated_at',
    )
    .single()

  if (result.error) {
    throw result.error
  }

  return mapBrandProfileRow(result.data as BrandProfileRow)
}
