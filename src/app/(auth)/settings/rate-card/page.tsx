import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { RateCardForm } from '@/components/settings/RateCardForm'

export default async function RateCardSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Rate Card</h1>
      <RateCardForm isAdmin={admin} />
    </div>
  )
}
