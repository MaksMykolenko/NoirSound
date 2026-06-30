'use strict';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePagination(query = {}) {
  const page = positiveInteger(query.page, 1);
  const pageSize = Math.min(
    positiveInteger(query.pageSize || query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

function paginationMeta(total, page, pageSize) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function sanitizeSearch(value, maxLength = 120) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function enumFilter(value, allowed) {
  if (!value) return null;
  const normalized = String(value).toUpperCase();
  return allowed.includes(normalized) ? normalized : undefined;
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  paginationMeta,
  sanitizeSearch,
  enumFilter
};
