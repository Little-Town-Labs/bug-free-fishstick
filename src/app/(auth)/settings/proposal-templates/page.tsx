import { getAuthContext, isAdmin } from '@/lib/utils/auth'
import { ProposalTemplateLibrary } from '@/components/settings/proposal-templates/ProposalTemplateLibrary'

export default async function ProposalTemplatesSettingsPage() {
  const context = await getAuthContext()
  const admin = context ? isAdmin(context.orgRole) : false

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Proposal Templates</h1>
      <ProposalTemplateLibrary isAdmin={admin} />
    </div>
  )
}
