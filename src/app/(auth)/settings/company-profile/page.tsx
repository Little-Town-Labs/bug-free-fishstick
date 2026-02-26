import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { CompanyProfileForm } from '@/components/settings/CompanyProfileForm'

export default async function CompanyProfileSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Company Profile</h1>
      <CompanyProfileForm isAdmin={admin} />
    </div>
  )
}
