import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Database,
  EyeOff,
  FileAudio,
  Flag,
  HardDrive,
  HardDriveUpload,
  MessageSquare,
  Music2,
  ScrollText,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Zap,
} from 'lucide-react';
import { getAdminOverview } from '../../api/admin';
import {
  AdminError,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  StatusBadge,
} from '../../components/admin/AdminUI';
import { useAdminData } from '../../components/admin/adminUtils';

function valueOrUnavailable(value, unavailable, locale) {
  return Number.isFinite(value) ? value.toLocaleString(locale) : unavailable;
}

function sumWhenAvailable(...values) {
  return values.every(Number.isFinite)
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

const SYSTEM_SERVICE_ICONS = {
  api: Server,
  database: Database,
  redis: Zap,
  storage: HardDrive,
  worker: Cpu,
  ffmpeg: FileAudio,
};

export default function AdminOverview() {
  const { t, i18n } = useTranslation();
  const { data, loading, error, reload } = useAdminData(getAdminOverview);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError error={error} onRetry={reload} />;

  const unavailable = t('admin.unavailable');
  const locale = i18n.language;
  const restrictedUsers = sumWhenAvailable(data?.users?.suspended, data?.users?.banned);

  const statCards = [
    {
      label: t('admin.publishedTracks'),
      value: data?.tracks?.published,
      icon: Music2,
      to: '/admin/tracks?status=PUBLISHED',
      tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      hint: t('admin.publishedTracksDesc', { defaultValue: 'В активному каталозі' }),
    },
    {
      label: t('admin.hiddenTracks'),
      value: data?.tracks?.hidden,
      icon: EyeOff,
      to: '/admin/tracks?status=HIDDEN',
      tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      hint: t('admin.hiddenTracksDesc', { defaultValue: 'Приховано / на розгляді' }),
    },
    {
      label: t('admin.activeUsers'),
      value: data?.users?.active,
      icon: UsersRound,
      to: '/admin/users?status=ACTIVE',
      tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      hint: t('admin.activeUsersDesc', { defaultValue: 'Зареєстровані акаунти' }),
    },
    {
      label: t('admin.restrictedUsers'),
      value: restrictedUsers,
      icon: ShieldAlert,
      to: '/admin/users',
      tone: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      hint: t('admin.restrictedUsersDesc', { defaultValue: 'Блокування та санкції' }),
    },
    {
      label: t('admin.commentsToday'),
      value: data?.comments?.today,
      icon: MessageSquare,
      to: '/admin/comments',
      tone: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      hint: t('admin.commentsTodayDesc', { defaultValue: 'Активність за добу' }),
    },
    {
      label: t('admin.playEventsToday'),
      value: data?.playEvents?.today,
      icon: Activity,
      to: '/admin/system',
      tone: 'text-[var(--ns-accent)] bg-[var(--ns-accent-soft)] border-[var(--ns-accent-border)]',
      hint: t('admin.playEventsTodayDesc', { defaultValue: 'Стрімінг за 24 години' }),
    },
  ];

  const attentionItems = [
    {
      label: t('admin.pendingReports'),
      value: data?.reports?.pending,
      status: 'PENDING',
      icon: Flag,
      to: '/admin/reports?status=OPEN',
      tone: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description: t('admin.reportsReviewDesc', { defaultValue: 'Скарги від користувачів' }),
    },
    {
      label: t('admin.failedUploads'),
      value: data?.uploads?.failed,
      status: 'FAILED',
      icon: AlertTriangle,
      to: '/admin/uploads?status=FAILED',
      tone: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      description: t('admin.failedUploadsDesc', { defaultValue: 'Помилки обробки треків' }),
    },
    {
      label: t('admin.processingUploads'),
      value: data?.uploads?.processing,
      status: 'PROCESSING',
      icon: HardDriveUpload,
      to: '/admin/uploads?status=PROCESSING',
      tone: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      description: t('admin.processingUploadsDesc', { defaultValue: 'Файли в черзі конвертації' }),
    },
  ];

  const quickShortcuts = [
    {
      label: t('admin.tracks'),
      to: '/admin/tracks',
      icon: Music2,
      desc: t('admin.catalogManagement', { defaultValue: 'Керування каталогом треків' }),
    },
    {
      label: t('admin.comments'),
      to: '/admin/comments',
      icon: MessageSquare,
      desc: t('admin.commentModeration', { defaultValue: 'Модерація обговорень' }),
    },
    {
      label: t('admin.auditLogs'),
      to: '/admin/audit-logs',
      icon: ScrollText,
      desc: t('admin.auditLogsDesc', { defaultValue: 'Історія дій модерації' }),
    },
    {
      label: t('admin.settings'),
      to: '/admin/settings',
      icon: Settings,
      desc: t('admin.platformConfig', { defaultValue: 'Параметри платформи' }),
    },
  ];

  const systemCheckNames = ['api', 'database', 'redis', 'storage', 'worker', 'ffmpeg'];
  const isHealthy =
    String(data?.system?.status || '').toUpperCase() === 'READY' ||
    String(data?.system?.status || '').toUpperCase() === 'HEALTHY' ||
    String(data?.system?.status || '').toUpperCase() === 'OK';

  return (
    <div className="space-y-6">
      {/* Header with live operational badge */}
      <AdminPageHeader
        title={t('admin.overview')}
        description={t('admin.overviewDescription')}
        actions={
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{isHealthy ? t('admin.allSystemsReady', { defaultValue: 'Усі системи готові' }) : t('admin.systemAttention', { defaultValue: 'Потрібна увага' })}</span>
          </div>
        }
      />

      {/* KPI Metric Cards Grid */}
      <section aria-label={t('admin.overview')} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.to}
              className="group relative flex flex-col justify-between rounded-xl border border-[var(--ns-border-subtle)] bg-[var(--ns-card-solid)] p-4 transition-all duration-200 hover:border-[var(--ns-accent)]/45 hover:bg-[var(--ns-card-elevated)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ns-accent)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${card.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <ArrowUpRight
                  className="h-3.5 w-3.5 text-[var(--ns-text-muted)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--ns-accent)]"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-4">
                <span className="block font-sans text-2xl font-bold tabular-nums text-[var(--ns-text)] sm:text-3xl">
                  {valueOrUnavailable(card.value, unavailable, locale)}
                </span>
                <span className="mt-1.5 block min-h-[2.25rem] text-xs font-semibold leading-snug text-[var(--ns-text-secondary)] group-hover:text-[var(--ns-text)] line-clamp-2">
                  {card.label}
                </span>
                <span className="mt-0.5 block truncate text-ns-meta text-[var(--ns-text-muted)]">
                  {card.hint}
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Main 2-Column Split */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (7 cols): Attention Queue + Quick Actions */}
        <div className="space-y-6 lg:col-span-7">
          {/* Attention Queue */}
          <AdminPanel className="overflow-hidden rounded-xl border border-[var(--ns-border-subtle)] bg-[var(--ns-card-solid)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--ns-border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <h2 className="text-sm font-bold tracking-tight text-[var(--ns-text)]">
                  {t('admin.attentionQueue', { defaultValue: t('admin.quickActions') })}
                </h2>
              </div>
              <span className="rounded-full border border-[var(--ns-border-subtle)] bg-[var(--ns-bg-elevated)] px-2.5 py-0.5 text-ns-meta font-semibold uppercase tracking-ns-label text-[var(--ns-text-muted)]">
                {t('admin.priority', { defaultValue: 'Пріоритет' })}
              </span>
            </div>
            <ul className="divide-y divide-[var(--ns-border-subtle)]">
              {attentionItems.map(({ label, value, status, icon: Icon, to, tone, description }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--ns-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ns-accent)]"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--ns-text)] group-hover:text-[var(--ns-text-primary)]">
                          {label}
                        </span>
                        <span className="block truncate text-ns-meta text-[var(--ns-text-muted)]">
                          {description}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={status} />
                      <span className="min-w-[2.5rem] text-right font-sans text-base font-bold tabular-nums text-[var(--ns-text)]">
                        {valueOrUnavailable(value, unavailable, locale)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-[var(--ns-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ns-accent)]" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminPanel>

          {/* Quick Operational Shortcuts */}
          <AdminPanel className="overflow-hidden rounded-xl border border-[var(--ns-border-subtle)] bg-[var(--ns-card-solid)] shadow-sm">
            <div className="border-b border-[var(--ns-border-subtle)] px-5 py-4">
              <h2 className="text-sm font-bold tracking-tight text-[var(--ns-text)]">
                {t('admin.quickActions', { defaultValue: 'Швидкі дії' })}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-px bg-[var(--ns-border-subtle)] sm:grid-cols-2">
              {quickShortcuts.map((shortcut) => {
                const Icon = shortcut.icon;
                return (
                  <Link
                    key={shortcut.label}
                    to={shortcut.to}
                    className="group flex items-center gap-3.5 bg-[var(--ns-card-solid)] p-4 transition-colors hover:bg-[var(--ns-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ns-accent)]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--ns-border-subtle)] bg-[var(--ns-bg-elevated)] text-[var(--ns-text-secondary)] transition-colors group-hover:border-[var(--ns-accent-border)] group-hover:text-[var(--ns-accent)]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--ns-text)] group-hover:text-[var(--ns-text-primary)]">
                        {shortcut.label}
                      </span>
                      <span className="block truncate text-ns-meta text-[var(--ns-text-muted)]">
                        {shortcut.desc}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--ns-text-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </AdminPanel>
        </div>

        {/* Right Column (5 cols): System Status & Service Health Grid */}
        <div className="space-y-6 lg:col-span-5">
          <AdminPanel className="overflow-hidden rounded-xl border border-[var(--ns-border-subtle)] bg-[var(--ns-card-solid)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--ns-border-subtle)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Server className="h-4 w-4 text-[var(--ns-accent)]" aria-hidden="true" />
                <h2 className="text-sm font-bold tracking-tight text-[var(--ns-text)]">
                  {t('admin.systemStatus')}
                </h2>
              </div>
              <StatusBadge status={data?.system?.status} />
            </div>

            {/* Structured Service Health Tiles */}
            <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2">
              {systemCheckNames.map((name) => {
                const Icon = SYSTEM_SERVICE_ICONS[name] || Server;
                const status = data?.system?.checks?.[name] || 'unavailable';
                const isCheckOk = String(status).toUpperCase() === 'OK' || String(status).toUpperCase() === 'HEALTHY';
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between gap-2.5 rounded-lg border border-[var(--ns-border-subtle)] bg-[var(--ns-bg-elevated)] p-3 transition-colors hover:border-[var(--ns-border-strong)]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--ns-surface-active)] text-[var(--ns-text-secondary)]">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      <span className="truncate text-xs font-semibold text-[var(--ns-text-secondary)]">
                        {t(`admin.systemChecks.${name}`)}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isCheckOk ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]'}`}
                        aria-hidden="true"
                      />
                      <StatusBadge status={status} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Deep link to telemetry */}
            <Link
              to="/admin/system"
              className="flex items-center justify-between border-t border-[var(--ns-border-subtle)] px-5 py-3.5 text-xs font-semibold text-[var(--ns-text-secondary)] transition-colors hover:bg-[var(--ns-hover-bg)] hover:text-[var(--ns-text)]"
            >
              <span>{t('admin.detailedTelemetry', { defaultValue: 'Детальна діагностика та метрики' })}</span>
              <ArrowRight className="h-3.5 w-3.5 text-[var(--ns-text-muted)]" aria-hidden="true" />
            </Link>
          </AdminPanel>
        </div>
      </div>
    </div>
  );
}
