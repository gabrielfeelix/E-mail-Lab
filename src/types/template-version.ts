import type { CompanyId } from '../data/companies'

export type TemplateVersionRecord = {
  category: string
  companyId: CompanyId
  createdAt: string
  id: string
  markup: string
  name: string
  subject: string
  templateId: string
  versionNumber: number
}
