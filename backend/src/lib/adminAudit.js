'use strict';

const { AUDIT_RESULTS, redactAuditMetadata } = require('./auditLog');

const AUDIT_PAGE_SIZES = Object.freeze([25, 50, 100]);
const AUDIT_ENVIRONMENTS = Object.freeze(['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST', 'DEMO']);
const AUDIT_QUERY_KEYS = new Set([
  'q',
  'action',
  'resource',
  'targetType',
  'targetId',
  'actor',
  'from',
  'to',
  'environment',
  'result',
  'page',
  'pageSize',
  'limit'
]);

class AdminAuditQueryError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'AdminAuditQueryError';
    this.field = field;
  }
}

function queryScalar(query, field) {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new AdminAuditQueryError(field, `${field} must be a single string value.`);
  }
  return value;
}

function boundedText(query, field, { max, min = 1, upper = false, pattern } = {}) {
  const value = queryScalar(query, field);
  if (value === undefined || value === '') return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max || /\p{Cc}/u.test(trimmed)) {
    throw new AdminAuditQueryError(field, `${field} must contain ${min}-${max} printable characters.`);
  }
  const normalized = upper ? trimmed.toUpperCase() : trimmed;
  if (pattern && !pattern.test(normalized)) {
    throw new AdminAuditQueryError(field, `${field} has an invalid format.`);
  }
  return normalized;
}

function positiveInteger(query, field, fallback) {
  const value = queryScalar(query, field);
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value)) {
    throw new AdminAuditQueryError(field, `${field} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AdminAuditQueryError(field, `${field} must be a positive integer.`);
  }
  return parsed;
}

function strictDate(query, field, endOfDay = false) {
  const value = queryScalar(query, field);
  if (value === undefined || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new AdminAuditQueryError(field, `${field} must be a real calendar date.`);
    }
    return date;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    throw new AdminAuditQueryError(field, `${field} must be YYYY-MM-DD or a UTC ISO timestamp.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AdminAuditQueryError(field, `${field} must be a valid UTC timestamp.`);
  }
  return date;
}

function parseCommonAuditFilters(query = {}) {
  for (const key of Object.keys(query)) {
    if (!AUDIT_QUERY_KEYS.has(key)) {
      throw new AdminAuditQueryError(key, `Unsupported audit filter: ${key}.`);
    }
  }

  const resource = boundedText(query, 'resource', {
    max: 40,
    upper: true,
    pattern: /^[A-Z][A-Z0-9_]*$/
  });
  const legacyTargetType = boundedText(query, 'targetType', {
    max: 40,
    upper: true,
    pattern: /^[A-Z][A-Z0-9_]*$/
  });
  if (resource && legacyTargetType && resource !== legacyTargetType) {
    throw new AdminAuditQueryError('resource', 'resource and targetType filters must match when both are supplied.');
  }

  const environment = boundedText(query, 'environment', { max: 20, upper: true });
  if (environment && !AUDIT_ENVIRONMENTS.includes(environment)) {
    throw new AdminAuditQueryError('environment', `environment must be one of: ${AUDIT_ENVIRONMENTS.join(', ')}.`);
  }
  const result = boundedText(query, 'result', { max: 20, upper: true });
  if (result && !AUDIT_RESULTS.includes(result)) {
    throw new AdminAuditQueryError('result', `result must be one of: ${AUDIT_RESULTS.join(', ')}.`);
  }

  const from = strictDate(query, 'from');
  const to = strictDate(query, 'to', true);
  if (from && to && from.getTime() > to.getTime()) {
    throw new AdminAuditQueryError('from', 'from must be earlier than or equal to to.');
  }

  return {
    q: boundedText(query, 'q', { min: 1, max: 120 }),
    action: boundedText(query, 'action', {
      max: 100,
      upper: true,
      pattern: /^[A-Z][A-Z0-9_]*$/
    }),
    resource: resource || legacyTargetType,
    targetId: boundedText(query, 'targetId', { max: 120 }),
    actor: boundedText(query, 'actor', { max: 120 }),
    from,
    to,
    environment,
    result
  };
}

function parseAuditListQuery(query = {}) {
  const filters = parseCommonAuditFilters(query);
  const page = positiveInteger(query, 'page', 1);
  const pageSizeValue = query.pageSize ?? query.limit;
  if (query.pageSize !== undefined && query.limit !== undefined && query.pageSize !== query.limit) {
    throw new AdminAuditQueryError('pageSize', 'pageSize and limit must match when both are supplied.');
  }
  const pageSize = positiveInteger({ pageSize: pageSizeValue }, 'pageSize', 25);
  if (!AUDIT_PAGE_SIZES.includes(pageSize)) {
    throw new AdminAuditQueryError('pageSize', `pageSize must be one of: ${AUDIT_PAGE_SIZES.join(', ')}.`);
  }
  if (page > 1_000_000) {
    throw new AdminAuditQueryError('page', 'page is too large.');
  }
  return {
    ...filters,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

function parseAuditExportQuery(query = {}) {
  if (query.page !== undefined || query.pageSize !== undefined) {
    throw new AdminAuditQueryError('page', 'CSV export does not accept page or pageSize. Use limit instead.');
  }
  const filters = parseCommonAuditFilters(query);
  const limit = positiveInteger(query, 'limit', 1000);
  if (limit > 5000) {
    throw new AdminAuditQueryError('limit', 'CSV export limit cannot exceed 5000 rows.');
  }
  return { ...filters, limit };
}

function auditActorSearch(value, includePii) {
  return {
    OR: [
      { id: { contains: value, mode: 'insensitive' } },
      ...(includePii ? [{ email: { contains: value, mode: 'insensitive' } }] : []),
      { username: { contains: value, mode: 'insensitive' } },
      { displayName: { contains: value, mode: 'insensitive' } }
    ]
  };
}

function buildAuditWhere(filters, options = {}) {
  const includePii = options.includePii === true;
  const and = [];
  if (filters.q) {
    and.push({
      OR: [
        { id: { contains: filters.q, mode: 'insensitive' } },
        { action: { contains: filters.q, mode: 'insensitive' } },
        { targetType: { contains: filters.q, mode: 'insensitive' } },
        { targetId: { contains: filters.q, mode: 'insensitive' } },
        { reason: { contains: filters.q, mode: 'insensitive' } },
        { metadata: { path: ['context', 'request', 'id'], string_contains: filters.q } },
        { actor: auditActorSearch(filters.q, includePii) }
      ]
    });
  }
  if (filters.action) and.push({ action: filters.action });
  if (filters.resource) and.push({ targetType: filters.resource });
  if (filters.targetId) and.push({ targetId: { contains: filters.targetId, mode: 'insensitive' } });
  if (filters.actor) {
    and.push({ actor: auditActorSearch(filters.actor, includePii) });
  }
  if (filters.from || filters.to) {
    and.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {})
      }
    });
  }
  if (filters.environment) {
    and.push({ metadata: { path: ['context', 'environment'], equals: filters.environment } });
  }
  if (filters.result) {
    and.push({ metadata: { path: ['context', 'result'], equals: filters.result } });
  }
  return and.length ? { AND: and } : {};
}

function publicAuditRecord(log, options = {}) {
  const includePii = options.includePii === true;
  const metadata = redactAuditMetadata(log.metadata, { includePii });
  const context = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata.context
    : null;
  return {
    id: log.id,
    actorId: log.actorId || null,
    actor: log.actor ? {
      id: log.actor.id,
      username: log.actor.username,
      displayName: log.actor.displayName,
      role: log.actor.role || null,
      ...(includePii ? { email: log.actor.email || null } : {})
    } : null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    reason: log.reason || null,
    metadata,
    createdAt: log.createdAt,
    source: context?.source || null,
    environment: context?.environment || null,
    result: context?.result || null,
    requestId: context?.request?.id || null
  };
}

function csvSafeValue(value) {
  const stringValue = value === null || value === undefined
    ? ''
    : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  return /^\s*[=+\-@\t\r]/.test(stringValue) ? `'${stringValue}` : stringValue;
}

function csvCell(value) {
  return `"${csvSafeValue(value).replace(/"/g, '""')}"`;
}

function auditLogsCsv(logs, options = {}) {
  const rows = logs.map((log) => publicAuditRecord(log, options));
  const columns = [
    'id',
    'createdAt',
    'actorId',
    'actorEmail',
    'actorUsername',
    'action',
    'resource',
    'targetId',
    'reason',
    'source',
    'environment',
    'result',
    'requestId',
    'metadata'
  ];
  const values = rows.map((log) => [
    log.id,
    log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
    log.actorId,
    log.actor?.email,
    log.actor?.username,
    log.action,
    log.targetType,
    log.targetId,
    log.reason,
    log.source,
    log.environment,
    log.result,
    log.requestId,
    log.metadata
  ]);
  return [columns.map(csvCell).join(','), ...values.map((row) => row.map(csvCell).join(','))].join('\r\n');
}

module.exports = {
  AUDIT_ENVIRONMENTS,
  AUDIT_PAGE_SIZES,
  AdminAuditQueryError,
  auditLogsCsv,
  buildAuditWhere,
  csvSafeValue,
  parseAuditExportQuery,
  parseAuditListQuery,
  publicAuditRecord
};
