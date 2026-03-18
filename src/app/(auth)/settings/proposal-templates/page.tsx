import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { ProposalTemplateLibrary } from '@/components/settings/proposal-templates/ProposalTemplateLibrary'

export default async function ProposalTemplatesSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return <ProposalTemplateLibrary isAdmin={admin} />
}
