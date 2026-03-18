import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { RateCardForm } from '@/components/settings/RateCardForm'

export default async function RateCardSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return <RateCardForm isAdmin={admin} />
}
