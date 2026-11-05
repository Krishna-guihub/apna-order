import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Filter, Search, ShieldCheck } from 'lucide-react';
import { AdminLoading, AdminSectionHeader } from './shared.jsx';
import { Badge, EmptyState, ErrorState } from '../ui.jsx';
import { api } from '../../api/client.js';
import { formatDateTime, parseApiError } from '../../utils/format.js';

const ROLE_TONE = {
  admin: 'green',
  staff: 'blue',
  customer: 'amber',
  system: 'neutral',
  payment_gateway: 'orange',
};

function actionTone(action = '') {
  if (action.includes('REFUND')) return 'orange';
  if (action.includes('REJECT')) return 'red';
  if (action.includes('PAYMENT') || action.includes('WEBHOOK')) return 'green';
  if (action.includes('TABLE_TOKEN')) return 'amber';
  return 'neutral';
}

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.get('/admin/audit-logs?limit=200');
      setLogs(data.logs);
      setError('');
    } catch (loadError) {
      setError(parseApiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const scopes = useMemo(() => {
    const set = new Set(logs.map((log) => log.action));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (scope !== 'all' && log.action !== scope) return false;
      if (
        term &&
        !`${log.action} ${log.entityType} ${log.entityId} ${log.user || ''} ${log.email || ''} ${
          log.ipAddress || ''
        }`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [logs, scope, search]);

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Audit trail"
        title="A quiet, complete record of change."
        description="Authentication, orders, discounts, table tokens, payments, webhooks, refunds and settings all leave an immutable entry with actor and metadata."
        busy={refreshing}
        onRefresh={() => loadLogs()}
      />

      <div className="admin-audit-banner">
        <span className="admin-audit-icon">
          <ShieldCheck size={18} />
        </span>
        <div>
          <strong>Audit entries are append-only.</strong>
          <span>
            The API never exposes update or delete endpoints for this table. Use it to reconstruct who
            changed what and when.
          </span>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="search-box admin-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search action, entity, actor or IP…"
            aria-label="Search audit logs"
          />
        </div>
        <label className="compact-field" htmlFor="audit-scope">
          <span>
            <Filter size={13} /> Action
          </span>
          <select id="audit-scope" value={scope} onChange={(event) => setScope(event.target.value)}>
            {scopes.map((value) => (
              <option value={value} key={value}>
                {value === 'all' ? 'All actions' : value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <span className="admin-toolbar-count">
          {filtered.length} of {logs.length} entries
        </span>
      </div>

      {error && (
        <ErrorState title="Audit log could not load" message={error} onRetry={() => loadLogs()} />
      )}

      {loading ? (
        <AdminLoading label="Reading the audit trail…" rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No audit entries match"
          message="Actions performed in the app will appear here with metadata."
        />
      ) : (
        <div className="admin-panel admin-panel-list">
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-audit">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Metadata</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td className="admin-muted admin-nowrap">{formatDateTime(log.createdAt)}</td>
                    <td>
                      <Badge tone={ROLE_TONE[log.actorRole] || 'neutral'}>{log.actorRole}</Badge>
                      <small>{log.user || log.email || 'System / anonymous'}</small>
                    </td>
                    <td>
                      <Badge tone={actionTone(log.action)}>{log.action.replaceAll('_', ' ')}</Badge>
                    </td>
                    <td>
                      <span className="admin-table-strong">{log.entityType}</span>
                      <small className="mono">{log.entityId || '—'}</small>
                    </td>
                    <td className="admin-audit-meta">
                      <code>{JSON.stringify(log.metadata)}</code>
                    </td>
                    <td className="admin-muted mono">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
