import React, { useEffect, useState, useCallback } from 'react';
import { ShieldAlert, Flag, ScrollText, EyeOff, UserX, Check, X } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useToastStore } from '../store/toastStore';
import EmptyState from '../components/ui/EmptyState';
import {
  getReports, resolveReport, hideTrack, hideComment, suspendUser, getAuditLogs, getAdminSummary,
} from '../api/moderation';

const STATUS_TABS = ['OPEN', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'];

function Pill({ children, tone = 'zinc' }) {
  const tones = {
    zinc: 'bg-zinc-800 text-zinc-300',
    red: 'bg-brand-red/20 text-brand-red',
    green: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-400',
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

export default function Admin() {
  const user = useUserStore((s) => s.user);
  const authHydrated = useUserStore((s) => s.authHydrated);
  const addToast = useToastStore((s) => s.addToast);

  const [tab, setTab] = useState('reports');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = user && user.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError(null);
    try {
      if (tab === 'reports') {
        const [r, s] = await Promise.all([getReports(statusFilter), getAdminSummary().catch(() => null)]);
        setReports(r); setSummary(s);
      } else {
        setLogs(await getAuditLogs());
      }
    } catch (err) {
      setError(err.message || 'Could not load moderation data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, tab, statusFilter]);

  useEffect(() => { load(); }, [load]);

  if (authHydrated && !isAdmin) {
    return (
      <EmptyState
        iconName="ShieldAlert"
        title="Admins only"
        description="You need an administrator account to access moderation tools."
      />
    );
  }

  async function act(fn, successMsg) {
    try {
      await fn();
      addToast(successMsg, 'success');
      load();
    } catch (err) {
      addToast(err.message || 'Action failed.', 'error');
    }
  }

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 mb-6">
        <ShieldAlert className="w-7 h-7 text-brand-red" />
        <h1 className="text-2xl font-black tracking-tight text-white">Moderation</h1>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-zinc-900/70 rounded-xl p-4 border border-zinc-800">
            <div className="text-2xl font-black text-white">{summary.openReports}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Open reports</div>
          </div>
          <div className="bg-zinc-900/70 rounded-xl p-4 border border-zinc-800">
            <div className="text-2xl font-black text-white">{summary.hiddenTracks}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Hidden tracks</div>
          </div>
          <div className="bg-zinc-900/70 rounded-xl p-4 border border-zinc-800">
            <div className="text-2xl font-black text-white">{summary.suspendedUsers}</div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Suspended users</div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5 border-b border-zinc-800">
        {[['reports', 'Reports', Flag], ['audit', 'Audit log', ScrollText]].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-brand-red text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                statusFilter === s ? 'bg-brand-red text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="py-16 text-center text-zinc-500">Loading…</div>}
      {error && !loading && (
        <div className="py-10 text-center text-brand-red">{error}</div>
      )}

      {!loading && !error && tab === 'reports' && (
        reports.length === 0 ? (
          <EmptyState iconName="Flag" title="No reports" description={`No ${statusFilter.toLowerCase().replace('_', ' ')} reports right now.`} />
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="bg-zinc-900/70 rounded-xl p-4 border border-zinc-800">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Pill tone="red">{r.reason}</Pill>
                  <Pill>{r.targetType}</Pill>
                  <Pill tone={r.status === 'OPEN' ? 'amber' : 'green'}>{r.status}</Pill>
                  <span className="text-xs text-zinc-500 ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-zinc-300 break-all">Target: <code className="text-zinc-400">{r.targetId}</code></p>
                {r.details && <p className="text-sm text-zinc-500 mt-1">“{r.details}”</p>}
                <p className="text-xs text-zinc-600 mt-1">Reported by {r.reporter?.username || 'unknown'}</p>

                <div className="flex flex-wrap gap-2 mt-3">
                  {r.targetType === 'TRACK' && (
                    <button onClick={() => act(() => hideTrack(r.targetId, `report:${r.id}`), 'Track hidden')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200">
                      <EyeOff className="w-3.5 h-3.5" /> Hide track
                    </button>
                  )}
                  {r.targetType === 'COMMENT' && (
                    <button onClick={() => act(() => hideComment(r.targetId, `report:${r.id}`), 'Comment hidden')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200">
                      <EyeOff className="w-3.5 h-3.5" /> Hide comment
                    </button>
                  )}
                  {r.targetType === 'USER' && (
                    <button onClick={() => act(() => suspendUser(r.targetId, `report:${r.id}`), 'User suspended')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200">
                      <UserX className="w-3.5 h-3.5" /> Suspend user
                    </button>
                  )}
                  {r.status === 'OPEN' && (
                    <>
                      <button onClick={() => act(() => resolveReport(r.id, 'ACTION_TAKEN'), 'Marked action taken')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-xs font-semibold text-white">
                        <Check className="w-3.5 h-3.5" /> Action taken
                      </button>
                      <button onClick={() => act(() => resolveReport(r.id, 'DISMISSED'), 'Report dismissed')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300">
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {!loading && !error && tab === 'audit' && (
        logs.length === 0 ? (
          <EmptyState iconName="ScrollText" title="No audit entries" description="Moderation actions will appear here." />
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 bg-zinc-900/70 rounded-lg px-4 py-2.5 border border-zinc-800 text-sm">
                <Pill tone="red">{l.action}</Pill>
                <span className="text-zinc-400">{l.targetType}</span>
                <code className="text-zinc-500 text-xs break-all">{l.targetId}</code>
                <span className="text-zinc-600 text-xs ml-auto">
                  {l.actor?.username || 'admin'} · {new Date(l.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
