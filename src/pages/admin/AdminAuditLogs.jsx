import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, RotateCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  exportAuditLogs,
  getAdminTrackPreview,
  getAuditLog,
  getAuditLogs,
} from '../../api/admin';
import AdminDetailDrawer from '../../components/admin/AdminDetailDrawer';
import AdminMediaPreview from '../../components/admin/AdminMediaPreview';
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminTable,
  AdminTableHead,
} from '../../components/admin/AdminUI';
import { formatAdminDate } from '../../components/admin/adminUtils';

const LIMIT_OPTIONS = [25, 50, 100];
const FILTER_KEYS = ['q', 'action', 'resource', 'actor', 'from', 'to', 'environment', 'result'];
const RESOURCE_OPTIONS = ['USER', 'TRACK', 'ARTIST', 'COMMENT', 'REPORT', 'UPLOAD', 'PLAYLIST', 'SYSTEM', 'AUDIT'];
const ENVIRONMENT_OPTIONS = ['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'TEST', 'DEMO'];
const RESULT_OPTIONS = ['SUCCESS', 'FAILURE', 'PARTIAL', 'DENIED'];
const RESOURCE_ROUTES = {
  USER: 'users',
  TRACK: 'tracks',
  ARTIST: 'artists',
  REPORT: 'reports',
};
const SENSITIVE_COPY_KEY = /(secret|password|passphrase|token|cookie|authorization|session|csrf|database.?url|storage.?key|audio.?key|image.?key|signed.?url|access.?key|private.?key|credential|ip.?address|user.?agent|email)/i;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function textValue(searchParams, key) {
  return String(searchParams.get(key) || '').slice(0, 200);
}

function entryId(entry) {
  return String(entry?.id || entry?.eventId || '');
}

function entryResource(entry) {
  return String(entry?.resource || entry?.targetType || 'UNKNOWN').toUpperCase();
}

function entryResourceId(entry) {
  return String(entry?.resourceId || entry?.targetId || '');
}

function entryActor(entry) {
  if (!entry?.actor) return '';
  if (typeof entry.actor === 'string') return entry.actor;
  return entry.actor.username || entry.actor.displayName || entry.actor.id || '';
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function humanizeToken(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function localizedToken(t, namespace, value) {
  const normalized = String(value || 'UNKNOWN').toUpperCase();
  return t(`${namespace}.${normalized}`, { defaultValue: humanizeToken(normalized) });
}

function resourceHref(resource, id) {
  if (resource === 'PLAYLIST' && id) return `/playlist/${encodeURIComponent(id)}`;
  if (resource === 'SYSTEM' && id) return '/admin/system';
  if (resource === 'COMMENT' && id) return `/admin/comments?search=${encodeURIComponent(id)}`;
  if (resource === 'UPLOAD' && id) return `/admin/uploads?search=${encodeURIComponent(id)}`;
  if (resource === 'AUDIT' && id) return `/admin/audit-logs?event=${encodeURIComponent(id)}`;
  const segment = RESOURCE_ROUTES[resource];
  return segment && id ? `/admin/${segment}/${encodeURIComponent(id)}` : '';
}

function sanitizeCopyValue(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeCopyValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => (
    [key, SENSITIVE_COPY_KEY.test(key) ? '[REDACTED]' : sanitizeCopyValue(item, depth + 1)]
  )));
}

function sanitizedEventJson(detail) {
  const actor = detail?.actor && typeof detail.actor === 'object' ? detail.actor : null;
  return JSON.stringify(sanitizeCopyValue({
    id: entryId(detail),
    createdAt: detail?.createdAt || null,
    actor: actor ? {
      id: actor.id || null,
      username: actor.username || null,
      displayName: actor.displayName || null,
      role: actor.role || null,
    } : detail?.actor || null,
    action: detail?.action || null,
    targetType: entryResource(detail),
    targetId: entryResourceId(detail),
    reason: detail?.reason || null,
    source: detail?.source || null,
    environment: detail?.environment || null,
    result: detail?.result || null,
    requestId: detail?.requestId || null,
    metadata: detail?.metadata || null,
  }), null, 2);
}

function AuditFilterField({ label, children }) {
  return (
    <label className="min-w-0 space-y-1.5">
      <span className="block font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-[var(--ns-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function CopyValueButton({ value, label }) {
  const { t } = useTranslation();
  const [copyState, setCopyState] = useState('idle');

  useEffect(() => {
    if (copyState === 'idle') return undefined;
    const timeout = window.setTimeout(() => setCopyState('idle'), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyValue = async () => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(String(value));
      } else {
        const field = document.createElement('textarea');
        field.value = String(value);
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        let copied = false;
        try {
          field.select();
          copied = Boolean(document.execCommand?.('copy'));
        } finally {
          field.remove();
        }
        if (!copied) throw new Error();
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const copied = copyState === 'copied';
  const failed = copyState === 'failed';

  return (
    <button
      type="button"
      onClick={copyValue}
      disabled={!value}
      aria-label={t(copied ? 'admin.audit.copiedValue' : failed ? 'admin.audit.copyFailedValue' : 'admin.audit.copyValue', { label })}
      aria-live="polite"
      className="ns-button-secondary inline-flex min-h-11 shrink-0 items-center gap-2 px-3 text-xs disabled:opacity-40"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {t(copied ? 'admin.audit.copied' : failed ? 'admin.audit.copyFailed' : 'admin.audit.copy')}
    </button>
  );
}

function AuditDetailItem({ label, value, mono = false, actions }) {
  return (
    <div className="min-w-0 border-b border-[var(--ns-border-subtle)] py-3 last:border-b-0">
      <dt className="font-sans tabular-nums text-ns-meta font-medium uppercase tracking-ns-label text-[var(--ns-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className={`min-w-0 break-words [overflow-wrap:anywhere] text-sm text-[var(--ns-text-secondary)] ${mono ? 'font-mono' : ''}`}>
          {value || '—'}
        </span>
        {actions && <span className="flex shrink-0 flex-wrap gap-2">{actions}</span>}
      </dd>
    </div>
  );
}

function AuditTimestamp({ value, language }) {
  const { t } = useTranslation();
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '—';
  const iso = date.toISOString();
  return (
    <span className="space-y-1">
      <span className="block">
        {t('admin.audit.localTime')}: <time dateTime={iso}>{formatAdminDate(value, language)}</time>
      </span>
      <span className="block font-mono text-ns-meta">
        {t('admin.audit.isoTime')}: <time dateTime={iso}>{iso}</time>
      </span>
    </span>
  );
}

function AuditActionBadge({ action }) {
  const { t } = useTranslation();
  return (
    <span className="ns-badge ns-status-badge border font-sans tabular-nums text-ns-meta font-medium tracking-ns-label ns-status-neutral">
      {localizedToken(t, 'admin.audit.actions', action)}
    </span>
  );
}

function AuditValueBadge({ namespace, value, tone = 'ns-status-neutral' }) {
  const { t } = useTranslation();
  return (
    <span className={`ns-badge ns-status-badge border font-sans tabular-nums text-ns-meta font-medium tracking-ns-label ${tone}`}>
      {localizedToken(t, `admin.audit.${namespace}`, value)}
    </span>
  );
}

function resultTone(result) {
  if (result === 'SUCCESS') return 'ns-status-success';
  if (result === 'PARTIAL') return 'ns-status-warning';
  if (result === 'FAILURE' || result === 'DENIED') return 'ns-status-danger';
  return 'ns-status-neutral';
}

export default function AdminAuditLogs() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [listRevision, setListRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const [listState, setListState] = useState({ data: null, loading: true, error: null });
  const [detailState, setDetailState] = useState({ data: null, loading: false, error: null });
  const [previewState, setPreviewState] = useState({ url: '', loading: false });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [queryDraft, setQueryDraft] = useState(() => textValue(searchParams, 'q'));

  const state = useMemo(() => {
    const requestedLimit = positiveInteger(searchParams.get('limit'), 50);
    return {
      q: textValue(searchParams, 'q'),
      action: textValue(searchParams, 'action'),
      resource: textValue(searchParams, 'resource').toUpperCase(),
      actor: textValue(searchParams, 'actor'),
      from: textValue(searchParams, 'from'),
      to: textValue(searchParams, 'to'),
      environment: textValue(searchParams, 'environment').toUpperCase(),
      result: textValue(searchParams, 'result').toUpperCase(),
      page: positiveInteger(searchParams.get('page'), 1),
      limit: LIMIT_OPTIONS.includes(requestedLimit) ? requestedLimit : 50,
      event: textValue(searchParams, 'event'),
    };
  }, [searchParams]);

  const setUrlValue = useCallback((key, value, { resetPage = true } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const normalized = String(value ?? '').trim();
      if (normalized) next.set(key, normalized);
      else next.delete(key);
      if (resetPage && key !== 'page') next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    setQueryDraft(state.q);
  }, [state.q]);

  useEffect(() => {
    if (queryDraft.trim() === state.q) return undefined;
    const timeout = window.setTimeout(() => setUrlValue('q', queryDraft), 300);
    return () => window.clearTimeout(timeout);
  }, [queryDraft, setUrlValue, state.q]);

  const listParams = useMemo(() => ({
    q: state.q,
    action: state.action,
    resource: state.resource,
    actor: state.actor,
    from: state.from,
    to: state.to,
    environment: state.environment,
    result: state.result,
    page: state.page,
    limit: state.limit,
  }), [
    state.action,
    state.actor,
    state.environment,
    state.from,
    state.limit,
    state.page,
    state.q,
    state.resource,
    state.result,
    state.to,
  ]);

  const exportParams = useMemo(() => Object.fromEntries(
    FILTER_KEYS.map((key) => [key, state[key]]).filter(([, value]) => value)
  ), [state]);

  useEffect(() => {
    const controller = new AbortController();
    setListState((current) => ({ ...current, loading: true, error: null }));
    Promise.resolve(getAuditLogs(listParams, { signal: controller.signal }))
      .then((data) => {
        if (!controller.signal.aborted) setListState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setListState((current) => ({ ...current, loading: false, error }));
        }
      });
    return () => controller.abort();
  }, [listParams, listRevision]);

  useEffect(() => {
    if (!state.event) {
      setDetailState({ data: null, loading: false, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setDetailState({ data: null, loading: true, error: null });
    Promise.resolve(getAuditLog(state.event, { signal: controller.signal }))
      .then((response) => {
        if (controller.signal.aborted) return;
        setDetailState({
          data: response?.auditLog || response?.event || response,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setDetailState({ data: null, loading: false, error });
        }
      });
    return () => controller.abort();
  }, [detailRevision, state.event]);

  const detail = detailState.data;
  const detailResource = entryResource(detail);
  const detailResourceId = entryResourceId(detail);

  useEffect(() => {
    let active = true;
    if (!detail || detailResource !== 'TRACK' || !detailResourceId) {
      setPreviewState({ url: '', loading: false });
      return () => { active = false; };
    }
    setPreviewState({ url: '', loading: true });
    Promise.resolve(getAdminTrackPreview(detailResourceId))
      .then((response) => {
        if (active) setPreviewState({ url: response?.url || '', loading: false });
      })
      .catch(() => {
        if (active) setPreviewState({ url: '', loading: false });
      });
    return () => { active = false; };
  }, [detail, detailResource, detailResourceId]);

  const resetFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      [...FILTER_KEYS, 'page', 'limit'].forEach((key) => next.delete(key));
      return next;
    });
  };

  const closeDetail = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('event');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const openDetail = (id) => {
    if (id) setUrlValue('event', id, { resetPage: false });
  };

  const exportLogs = async () => {
    setExporting(true);
    setExportError(false);
    try {
      const response = await exportAuditLogs(exportParams);
      const content = response?.csv ?? response?.content ?? response;
      const directUrl = response && typeof response === 'object' && !(response instanceof Blob)
        ? response.url
        : '';
      const objectUrl = directUrl ? '' : URL.createObjectURL(
        content instanceof Blob ? content : new Blob([String(content ?? '')], { type: 'text/csv;charset=utf-8' })
      );
      const link = document.createElement('a');
      link.href = directUrl || objectUrl;
      link.download = response?.fileName || 'noirsound-audit.csv';
      link.click();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };

  const rows = listState.data?.data || [];
  const hasFilters = FILTER_KEYS.some((key) => state[key]) || state.page !== 1 || state.limit !== 50;
  const detailActor = detail?.actor && typeof detail.actor === 'object' ? detail.actor : null;
  const detailMetadata = detail?.metadata && typeof detail.metadata === 'object' ? detail.metadata : null;
  const previousState = detail?.previousState ?? detailMetadata?.previousState;
  const newState = detail?.newState ?? detailMetadata?.newState;

  return (
    <>
      <AdminPageHeader
        title={t('admin.auditLogs')}
        description={t('admin.auditLogsDescription')}
        actions={(
          <>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="ns-button-secondary inline-flex min-h-11 items-center gap-2 px-3 text-sm disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('admin.audit.resetFilters')}
            </button>
            <button
              type="button"
              onClick={exportLogs}
              disabled={exporting}
              aria-busy={exporting || undefined}
              className="ns-button-primary inline-flex min-h-11 items-center gap-2 px-3 text-sm disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? t('admin.audit.exporting') : t('admin.audit.exportCsv')}
            </button>
          </>
        )}
      />

      {exportError && (
        <p role="alert" className="border-l-2 border-[var(--ns-danger)] px-3 py-2 text-sm text-[var(--ns-danger)]">
          {t('admin.audit.exportFailed')}
        </p>
      )}

      <AdminPanel className="p-3 sm:p-4">
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-[var(--ns-text)]">{t('admin.audit.filters')}</legend>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AuditFilterField label={t('admin.audit.search')}>
              <input
                type="search"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
                placeholder={t('admin.audit.searchPlaceholder')}
                className="ns-field w-full min-w-0 px-3 text-base sm:text-sm"
              />
            </AuditFilterField>
            <AuditFilterField label={t('admin.action')}>
              <input
                value={state.action}
                onChange={(event) => setUrlValue('action', event.target.value)}
                placeholder={t('admin.audit.actionPlaceholder')}
                className="ns-field w-full min-w-0 px-3 text-base sm:text-sm"
              />
            </AuditFilterField>
            <AuditFilterField label={t('admin.audit.resource')}>
              <select value={state.resource} onChange={(event) => setUrlValue('resource', event.target.value)} className="ns-field w-full min-w-0 px-3 text-base sm:text-sm">
                <option value="">{t('admin.audit.allResources')}</option>
                {RESOURCE_OPTIONS.map((value) => <option key={value} value={value}>{t(`admin.audit.resources.${value}`)}</option>)}
              </select>
            </AuditFilterField>
            <AuditFilterField label={t('admin.actor')}>
              <input
                value={state.actor}
                onChange={(event) => setUrlValue('actor', event.target.value)}
                placeholder={t('admin.audit.actorPlaceholder')}
                className="ns-field w-full min-w-0 px-3 text-base sm:text-sm"
              />
            </AuditFilterField>
            <AuditFilterField label={t('admin.audit.from')}>
              <input type="date" value={state.from} onChange={(event) => setUrlValue('from', event.target.value)} className="ns-field w-full min-w-0 px-3 text-base sm:text-sm" />
            </AuditFilterField>
            <AuditFilterField label={t('admin.audit.to')}>
              <input type="date" value={state.to} onChange={(event) => setUrlValue('to', event.target.value)} className="ns-field w-full min-w-0 px-3 text-base sm:text-sm" />
            </AuditFilterField>
            <AuditFilterField label={t('admin.audit.environment')}>
              <select value={state.environment} onChange={(event) => setUrlValue('environment', event.target.value)} className="ns-field w-full min-w-0 px-3 text-base sm:text-sm">
                <option value="">{t('admin.audit.allEnvironments')}</option>
                {ENVIRONMENT_OPTIONS.map((value) => <option key={value} value={value}>{t(`admin.audit.environments.${value}`)}</option>)}
              </select>
            </AuditFilterField>
            <AuditFilterField label={t('admin.audit.result')}>
              <select value={state.result} onChange={(event) => setUrlValue('result', event.target.value)} className="ns-field w-full min-w-0 px-3 text-base sm:text-sm">
                <option value="">{t('admin.audit.allResults')}</option>
                {RESULT_OPTIONS.map((value) => <option key={value} value={value}>{t(`admin.audit.results.${value}`)}</option>)}
              </select>
            </AuditFilterField>
            <AuditFilterField label={t('admin.audit.limit')}>
              <select value={state.limit} onChange={(event) => setUrlValue('limit', event.target.value)} className="ns-field w-full min-w-0 px-3 text-base sm:text-sm">
                {LIMIT_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </AuditFilterField>
          </div>
        </fieldset>
      </AdminPanel>

      <AdminPanel>
        {listState.loading ? <AdminLoading /> : listState.error ? (
          <AdminError error={listState.error} onRetry={() => setListRevision((value) => value + 1)} />
        ) : rows.length === 0 ? (
          <AdminEmpty text={t('admin.noAuditEntries')} />
        ) : (
          <AdminTable>
            <thead>
              <tr>
                {[t('admin.created'), t('admin.actor'), t('admin.action'), t('admin.audit.resource'), t('admin.reason'), t('admin.audit.result'), t('admin.audit.requestId')]
                  .map((label) => <AdminTableHead key={label}>{label}</AdminTableHead>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => {
                const id = entryId(entry);
                const resource = entryResource(entry);
                const resourceId = entryResourceId(entry);
                const result = String(entry.result || 'UNKNOWN').toUpperCase();
                return (
                  <tr
                    key={id}
                    tabIndex={0}
                    aria-haspopup="dialog"
                    aria-label={t('admin.audit.openEntry', {
                      action: localizedToken(t, 'admin.audit.actions', entry.action),
                      id,
                    })}
                    data-testid={`audit-row-${id}`}
                    onClick={(event) => {
                      event.currentTarget.focus();
                      openDetail(id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      openDetail(id);
                    }}
                    className="cursor-pointer border-t border-[var(--ns-border-subtle)] outline-none focus-visible:bg-[var(--ns-hover-bg)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ns-accent)]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--ns-text-muted)]">{formatAdminDate(entry.createdAt, i18n.language)}</td>
                    <td className="max-w-48 break-words px-4 py-3 text-sm">{entryActor(entry) ? `@${entryActor(entry)}` : '—'}</td>
                    <td className="px-4 py-3"><AuditActionBadge action={entry.action} /></td>
                    <td className="max-w-48 px-4 py-3">
                      <AuditValueBadge namespace="resources" value={resource} />
                      <span className="mt-1.5 block break-all font-mono text-ns-meta text-[var(--ns-text-muted)]" title={resourceId}>{resourceId || '—'}</span>
                    </td>
                    <td className="max-w-72 break-words px-4 py-3 text-sm text-[var(--ns-text-secondary)]">{entry.reason || '—'}</td>
                    <td className="px-4 py-3"><AuditValueBadge namespace="results" value={result} tone={resultTone(result)} /></td>
                    <td className="max-w-48 break-all px-4 py-3 font-mono text-ns-meta" title={entry.requestId}>{entry.requestId || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
        <AdminPagination pagination={listState.data?.pagination} onPage={(page) => setUrlValue('page', page, { resetPage: false })} />
      </AdminPanel>

      <AdminDetailDrawer
        open={Boolean(state.event)}
        onClose={closeDetail}
        title={t('admin.audit.detailTitle')}
        description={state.event}
        busy={detailState.loading}
      >
        {detailState.loading ? <AdminLoading /> : detailState.error ? (
          <AdminError error={detailState.error} onRetry={() => setDetailRevision((value) => value + 1)} />
        ) : detail ? (
          <div className="space-y-5">
            <dl>
              <AuditDetailItem
                label={t('admin.audit.event')}
                value={entryId(detail)}
                mono
                actions={<CopyValueButton value={entryId(detail)} label={t('admin.audit.event')} />}
              />
              <AuditDetailItem
                label={t('admin.created')}
                value={<AuditTimestamp value={detail.createdAt} language={i18n.language} />}
              />
              <AuditDetailItem label={t('admin.actor')} value={entryActor(detail) ? `@${entryActor(detail)}` : '—'} />
              {detailActor?.id && <AuditDetailItem label={t('admin.audit.actorId')} value={detailActor.id} mono />}
              {detailActor?.role && <AuditDetailItem label={t('admin.audit.actorRole')} value={localizedToken(t, 'admin.statusValues', detailActor.role)} />}
              <AuditDetailItem label={t('admin.action')} value={<AuditActionBadge action={detail.action} />} />
              <AuditDetailItem label={t('admin.audit.rawAction')} value={detail.action} mono />
              <AuditDetailItem label={t('admin.audit.resource')} value={<AuditValueBadge namespace="resources" value={detailResource} />} />
              {(detail.resourceName || detail.targetName) && <AuditDetailItem label={t('admin.audit.resourceName')} value={detail.resourceName || detail.targetName} />}
              <AuditDetailItem
                label={t('admin.targetId')}
                value={detailResourceId}
                mono
                actions={(
                  <>
                    <CopyValueButton value={detailResourceId} label={t('admin.targetId')} />
                    {resourceHref(detailResource, detailResourceId) && (
                      <Link
                        to={resourceHref(detailResource, detailResourceId)}
                        className="ns-button-secondary inline-flex min-h-11 items-center gap-2 px-3 text-xs"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        {t('admin.audit.openResource')}
                      </Link>
                    )}
                  </>
                )}
              />
              <AuditDetailItem label={t('admin.reason')} value={detail.reason} />
              {(detail.source || detailMetadata?.context?.source) && <AuditDetailItem label={t('admin.audit.source')} value={detail.source || detailMetadata.context.source} mono />}
              <AuditDetailItem label={t('admin.audit.environment')} value={<AuditValueBadge namespace="environments" value={detail.environment || 'UNKNOWN'} tone="ns-status-info" />} />
              <AuditDetailItem label={t('admin.audit.result')} value={<AuditValueBadge namespace="results" value={detail.result || 'UNKNOWN'} tone={resultTone(String(detail.result || 'UNKNOWN').toUpperCase())} />} />
              <AuditDetailItem
                label={t('admin.audit.requestId')}
                value={detail.requestId}
                mono
                actions={<CopyValueButton value={detail.requestId} label={t('admin.audit.requestId')} />}
              />
              {previousState !== undefined && <AuditDetailItem label={t('admin.audit.previousState')} value={JSON.stringify(previousState)} mono />}
              {newState !== undefined && <AuditDetailItem label={t('admin.audit.newState')} value={JSON.stringify(newState)} mono />}
              {detail.ipAddress && <AuditDetailItem label={t('admin.audit.ipAddress')} value={detail.ipAddress} mono />}
              {detail.userAgent && <AuditDetailItem label={t('admin.audit.userAgent')} value={detail.userAgent} />}
            </dl>

            {detailResource === 'TRACK' && (
              previewState.loading ? <AdminLoading /> : (
                <AdminMediaPreview
                  title={t('admin.audit.trackPreview')}
                  description={detailResourceId}
                  url={previewState.url}
                  mediaLabel={t('admin.audit.trackPreviewLabel', { id: detailResourceId })}
                  unavailableLabel={t('admin.audit.previewUnavailable')}
                  errorLabel={t('admin.audit.previewFailed')}
                />
              )
            )}

            <section className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-[var(--ns-text)]">{t('admin.audit.metadata')}</h3>
                <CopyValueButton value={sanitizedEventJson(detail)} label={t('admin.audit.sanitizedEventJson')} />
              </div>
              {detail.metadata ? (
                <pre className="mt-2 max-w-full overflow-auto rounded-md border border-[var(--ns-border-subtle)] bg-[var(--ns-bg)] p-3 font-mono text-ns-meta leading-relaxed text-[var(--ns-text-secondary)]">
                  {JSON.stringify(detail.metadata, null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-sm text-[var(--ns-text-muted)]">{t('admin.audit.noMetadata')}</p>
              )}
            </section>
          </div>
        ) : null}
      </AdminDetailDrawer>
    </>
  );
}
