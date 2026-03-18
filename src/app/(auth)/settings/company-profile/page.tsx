import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { CompanyProfileForm } from '@/components/settings/CompanyProfileForm'

export default async function CompanyProfileSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return <CompanyProfileForm isAdmin={admin} />
}
