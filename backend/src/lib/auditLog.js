'use strict';

function auditData(actorId, action, targetType, targetId, reason, metadata) {
  return {
    actorId,
    action,
    targetType,
    targetId,
    reason: reason || null,
    metadata: metadata || null
  };
}

function createAudit(tx, data) {
  return tx.auditLog.create({ data });
}

function redactAuditMetadata(value) {
  if (Array.isArray(value)) return value.map(redactAuditMetadata);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/(secret|password|token|database.?url|storage.?key|signed.?url|access.?key)/i.test(key)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactAuditMetadata(item)];
  }));
}

module.exports = { auditData, createAudit, redactAuditMetadata };
