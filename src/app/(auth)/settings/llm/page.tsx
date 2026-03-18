import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { SettingsForm } from '@/components/settings/SettingsForm'

export default async function LlmSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return <SettingsForm isAdmin={admin} />
}
