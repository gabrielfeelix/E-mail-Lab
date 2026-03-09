import type { CompanyId } from '../data/companies'

export type SectionKind = 'header' | 'footer'

export type SectionRecord = {
  companyId: CompanyId
  createdAt: string
  id: string
  isFavorite: boolean
  kind: SectionKind
  markup: string
  name: string
  updatedAt: string
}
