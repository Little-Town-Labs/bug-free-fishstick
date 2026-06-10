import { NextRequest, NextResponse } from 'next/server'
import { requireAdminLimited, AuthError } from '@/lib/utils/auth'
import { getIntegrationConfigWithCredentials, type IntegrationType } from '@/lib/services/integration-config'

const VALID_TYPES: IntegrationType[] = ['slack', 'salesforce', 'hubspot']

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const auth = await requireAdminLimited()
    const { type } = await params

    if (!VALID_TYPES.includes(type as IntegrationType)) {
      return NextResponse.json(
        { error: `Invalid integration type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const config = await getIntegrationConfigWithCredentials(auth.orgId, type as IntegrationType)
    if (!config) {
      return NextResponse.json({ error: 'Integration not configured' }, { status: 404 })
    }

    const credentials = config.credentials as Record<string, string>

    if (type === 'slack') {
      const { webhookUrl } = credentials
      if (!webhookUrl) {
        return NextResponse.json({ success: false, message: 'No webhook URL configured' }, { status: 200 })
      }
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Test message from RocketRFP :white_check_mark:' }),
      })
      return NextResponse.json({
        success: response.ok,
        message: response.ok ? 'Test message sent successfully' : `Webhook returned ${response.status}`,
      }, { status: 200 })
    }

    if (type === 'hubspot') {
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      })
      return NextResponse.json({
        success: response.ok,
        message: response.ok ? 'HubSpot connection verified' : `HubSpot API returned ${response.status}`,
      }, { status: 200 })
    }

    if (type === 'salesforce') {
      const instanceUrl = credentials.instanceUrl ?? 'https://login.salesforce.com'
      const response = await fetch(`${instanceUrl}/services/data/v58.0/limits`, {
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      })
      return NextResponse.json({
        success: response.ok,
        message: response.ok ? 'Salesforce connection verified' : `Salesforce API returned ${response.status}`,
      }, { status: 200 })
    }

    return NextResponse.json({ success: false, message: 'Unknown integration type' }, { status: 400 })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
