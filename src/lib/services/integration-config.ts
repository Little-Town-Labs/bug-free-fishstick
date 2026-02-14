import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  integrationConfigs,
  syncEvents,
  type IntegrationConfig,
  type NewIntegrationConfig,
  type SyncEvent,
  type NewSyncEvent,
  type IntegrationType,
  type SyncEventStatus,
} from '@/lib/db/schema'
import { encrypt, decrypt } from '@/lib/services/encryption'

// ---------------------------------------------------------------------------
// Integration config CRUD
// ---------------------------------------------------------------------------

export interface IntegrationCredentials {
  accessToken?: string
  refreshToken?: string
  webhookUrl?: string
  instanceUrl?: string
}

export interface IntegrationConfigSummary {
  id: string
  organizationId: string
  integrationType: IntegrationType
  isEnabled: boolean
  status: IntegrationConfig['status']
  lastVerifiedAt: Date | null
  configJson: IntegrationConfig['configJson']
  createdAt: Date
  updatedAt: Date
}

function toSummary(config: IntegrationConfig): IntegrationConfigSummary {
  const { credentialsEncrypted: _redacted, ...rest } = config
  return rest
}

export async function getIntegrationConfig(
  orgId: string,
  type: IntegrationType
): Promise<IntegrationConfigSummary | null> {
  const rows = await db
    .select()
    .from(integrationConfigs)
    .where(and(eq(integrationConfigs.organizationId, orgId), eq(integrationConfigs.integrationType, type)))
    .limit(1)
  return rows[0] ? toSummary(rows[0]) : null
}

export async function getIntegrationConfigWithCredentials(
  orgId: string,
  type: IntegrationType
): Promise<(IntegrationConfigSummary & { credentials: IntegrationCredentials }) | null> {
  const rows = await db
    .select()
    .from(integrationConfigs)
    .where(and(eq(integrationConfigs.organizationId, orgId), eq(integrationConfigs.integrationType, type)))
    .limit(1)
  if (!rows[0]) return null
  const credentials: IntegrationCredentials = JSON.parse(decrypt(rows[0].credentialsEncrypted))
  return { ...toSummary(rows[0]), credentials }
}

export async function listIntegrationConfigs(orgId: string): Promise<IntegrationConfigSummary[]> {
  const rows = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.organizationId, orgId))
  return rows.map(toSummary)
}

export async function upsertIntegrationConfig(
  orgId: string,
  type: IntegrationType,
  credentials: IntegrationCredentials,
  configJson: NonNullable<NewIntegrationConfig['configJson']>
): Promise<IntegrationConfigSummary> {
  const credentialsEncrypted = encrypt(JSON.stringify(credentials))
  const now = new Date()
  const rows = await db
    .insert(integrationConfigs)
    .values({
      organizationId: orgId,
      integrationType: type,
      isEnabled: true,
      credentialsEncrypted,
      configJson,
      status: 'active',
      lastVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [integrationConfigs.organizationId, integrationConfigs.integrationType],
      set: {
        credentialsEncrypted,
        configJson,
        isEnabled: true,
        status: 'active',
        lastVerifiedAt: now,
        updatedAt: now,
      },
    })
    .returning()
  return toSummary(rows[0]!)
}

export async function updateIntegrationStatus(
  orgId: string,
  type: IntegrationType,
  status: IntegrationConfig['status']
): Promise<void> {
  await db
    .update(integrationConfigs)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(integrationConfigs.organizationId, orgId), eq(integrationConfigs.integrationType, type)))
}

export async function deleteIntegrationConfig(orgId: string, type: IntegrationType): Promise<void> {
  await db
    .delete(integrationConfigs)
    .where(and(eq(integrationConfigs.organizationId, orgId), eq(integrationConfigs.integrationType, type)))
}

// ---------------------------------------------------------------------------
// Sync events
// ---------------------------------------------------------------------------

export async function createSyncEvent(data: Omit<NewSyncEvent, 'id' | 'createdAt'>): Promise<SyncEvent> {
  const rows = await db.insert(syncEvents).values(data).returning()
  return rows[0]!
}

export async function updateSyncEvent(
  id: string,
  data: Partial<Pick<SyncEvent, 'status' | 'responsePayload' | 'errorMessage' | 'attemptCount' | 'lastAttemptAt' | 'inngestEventId'>>
): Promise<void> {
  await db.update(syncEvents).set(data).where(eq(syncEvents.id, id))
}

export interface SyncEventFilters {
  status?: SyncEventStatus
  integrationType?: IntegrationType
}

export interface SyncEventSummary {
  id: string
  organizationId: string
  integrationType: string
  eventType: string
  referenceId: string
  status: SyncEventStatus
  errorMessage: string | null
  attemptCount: number
  lastAttemptAt: Date | null
  createdAt: Date
}

export async function listSyncEvents(
  orgId: string,
  filters: SyncEventFilters = {}
): Promise<SyncEventSummary[]> {
  const conditions = [eq(syncEvents.organizationId, orgId)]
  if (filters.status) conditions.push(eq(syncEvents.status, filters.status))
  if (filters.integrationType) conditions.push(eq(syncEvents.integrationType, filters.integrationType))

  const rows = await db
    .select({
      id: syncEvents.id,
      organizationId: syncEvents.organizationId,
      integrationType: syncEvents.integrationType,
      eventType: syncEvents.eventType,
      referenceId: syncEvents.referenceId,
      status: syncEvents.status,
      errorMessage: syncEvents.errorMessage,
      attemptCount: syncEvents.attemptCount,
      lastAttemptAt: syncEvents.lastAttemptAt,
      createdAt: syncEvents.createdAt,
    })
    .from(syncEvents)
    .where(and(...(conditions as [typeof conditions[0], ...typeof conditions])))
    .orderBy(syncEvents.createdAt)

  return rows as SyncEventSummary[]
}

export async function getSyncEvent(id: string): Promise<SyncEvent | null> {
  const rows = await db.select().from(syncEvents).where(eq(syncEvents.id, id)).limit(1)
  return rows[0] ?? null
}
