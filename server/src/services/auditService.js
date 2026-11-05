import { db, nowIso } from '../db.js';

export function logAudit({
  userId = null,
  actorRole = 'system',
  action,
  entityType,
  entityId = null,
  metadata = {},
  ipAddress = null,
}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs
        (user_id, actor_role, action, entity_type, entity_id, metadata_json, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      actorRole,
      action,
      entityType,
      entityId === null ? null : String(entityId),
      JSON.stringify(metadata),
      ipAddress,
      nowIso(),
    );
  } catch (error) {
    // Auditing must not break the customer flow, but the failure should be visible.
    console.error('[audit] Failed to write audit log:', error.message);
  }
}
