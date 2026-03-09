import type { CompanyId } from '../data/companies'

export type AdminAccessRecord = {
  companyIds: CompanyId[]
  email: string
  fullName: string
  isAdmin: boolean
  userId: string
}
