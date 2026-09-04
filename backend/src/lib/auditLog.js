'use strict';

const SENSITIVE_AUDIT_KEY = /(secret|password|passphrase|token|cookie|authorization|session.?id|session.?token|csrf|database.?url|storage.?key|audio.?key|image.?key|signed.?url|access.?key|private.?key|credential)/i;
const AUDIT_RESULTS = Object.freeze(['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED']);

function sanitizeAuditString(value) {
  const text = String(value).slice(0, 4000);
  if (/^\s*(?:bearer|basic)\s+/i.test(text)) return '[REDACTED]';
  return text
    .replace(/([?&](?:token|key|secret|password|signature|credential)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/:\/\/[^/@\s]+:[^/@\s]+@/g, '://[REDACTED]@');
}

function sanitizeAuditMetadata(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (typeof value === 'string') return sanitizeAuditString(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeAuditMetadata(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => {
    if (SENSITIVE_AUDIT_KEY.test(key)) return [key, '[REDACTED]'];
    return [key, sanitizeAuditMetadata(item, depth + 1)];
  }));
}

function normalizeAuditEnvironment(
  value = process.env.APP_ENVIRONMENT || process.env.DEPLOYMENT_ENV || process.env.NODE_ENV
) {
  const normalized = String(value || '').trim().toUpperCase();
  if (['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST', 'DEMO'].includes(normalized)) {
    return normalized;
  }
  return 'DEVELOPMENT';
}

function auditRequestContext(request, options = {}) {
  const result = AUDIT_RESULTS.includes(options.result) ? options.result : 'SUCCESS';
  return sanitizeAuditMetadata({
    source: options.source || 'ADMIN_API',
    environment: normalizeAuditEnvironment(options.environment),
    request: request ? {
      id: request.id || null,
      method: request.method || null,
      route: request.routeOptions?.url || request.url?.split('?')[0] || null
    } : null,
    result
  });
}

function auditData(actorId, action, targetType, targetId, reason, metadata, context) {
  const sanitizedMetadata = sanitizeAuditMetadata(metadata || {});
  const safeMetadata = sanitizedMetadata && typeof sanitizedMetadata === 'object' && !Array.isArray(sanitizedMetadata)
    ? sanitizedMetadata
    : { value: sanitizedMetadata };
  const safeContext = context ? sanitizeAuditMetadata(context) : null;
  return {
    actorId,
    action,
    targetType,
    targetId,
    reason: reason ? sanitizeAuditString(reason) : null,
    metadata: Object.keys(safeMetadata).length || safeContext
      ? { ...safeMetadata, ...(safeContext ? { context: safeContext } : {}) }
      : null
  };
}

function createAudit(tx, data) {
  return tx.auditLog.create({ data });
}

function redactAuditPii(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((item) => redactAuditPii(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const isPii = normalizedKey.includes('email') ||
      ['ip', 'ipaddress', 'clientip', 'remoteip', 'requestip', 'sourceip', 'ua'].includes(normalizedKey) ||
      normalizedKey.endsWith('useragent');
    if (isPii) return [key, '[REDACTED]'];
    return [key, redactAuditPii(item, depth + 1)];
  }));
}

function redactAuditMetadata(value, options = {}) {
  const sanitized = sanitizeAuditMetadata(value);
  return options.includePii ? sanitized : redactAuditPii(sanitized);
}

module.exports = {
  AUDIT_RESULTS,
  auditData,
  auditRequestContext,
  createAudit,
  normalizeAuditEnvironment,
  redactAuditMetadata,
  sanitizeAuditMetadata
};
