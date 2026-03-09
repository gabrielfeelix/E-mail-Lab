import type { CompanyId } from '../data/companies'

export type TemplateRecord = {
  category: string
  companyId: CompanyId
  createdAt: string
  id: string
  markup: string
  name: string
  subject: string
  updatedAt: string
}
