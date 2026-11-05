import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Table2,
} from 'lucide-react';
import { AdminLoading, AdminSectionHeader, Toggle } from './shared.jsx';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineAlert,
  Modal,
  Spinner,
} from '../ui.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime, parseApiError } from '../../utils/format.js';

export default function AdminTables() {
  const { addToast } = useToast();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ tableNumber: '', label: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [qrState, setQrState] = useState({ open: false, loading: false, data: null, table: null });
  const [rotateTarget, setRotateTarget] = useState(null);

  const loadTables = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.get('/admin/tables');
      setTables(data.tables);
      setError('');
    } catch (loadError) {
      setError(parseApiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const nextTableNumber =
    tables.length > 0 ? Math.max(...tables.map((table) => table.tableNumber)) + 1 : 1;

  const openAdd = () => {
    setForm({ tableNumber: String(nextTableNumber), label: '' });
    setFormError('');
    setAddOpen(true);
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    setFormError('');
    const tableNumber = Number(form.tableNumber);
    if (!Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 999) {
      setFormError('Enter a table number between 1 and 999.');
      return;
    }
    setSaving(true);
    try {
      const data = await api.post('/admin/tables', {
        tableNumber,
        label: form.label.trim(),
      });
      setTables((current) => [...current, data.table].sort((a, b) => a.tableNumber - b.tableNumber));
      addToast(`Table ${tableNumber} created with a fresh QR token.`, 'success');
      setAddOpen(false);
    } catch (saveError) {
      setFormError(parseApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (table) => {
    setBusyId(table.id);
    try {
      const data = await api.patch(`/admin/tables/${table.id}`, {
        isActive: !table.isActive,
        label: table.label || '',
      });
      setTables((current) =>
        current.map((row) => (row.id === table.id ? data.table : row)),
      );
      addToast(
        data.table.isActive
          ? `Table ${data.table.tableNumber} is accepting guests again.`
          : `Table ${data.table.tableNumber} QR is now inactive.`,
        'info',
      );
    } catch (toggleError) {
      addToast(parseApiError(toggleError), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openQr = async (table) => {
    setQrState({ open: true, loading: true, data: null, table });
    try {
      const data = await api.get(`/admin/tables/${table.id}/qr`);
      setQrState({ open: true, loading: false, data, table });
    } catch (qrError) {
      addToast(parseApiError(qrError), 'error');
      setQrState({ open: false, loading: false, data: null, table: null });
    }
  };

  const copyLink = async (table) => {
    try {
      await navigator.clipboard.writeText(table.menuUrl);
      addToast('Table menu link copied to the clipboard.', 'success');
    } catch {
      addToast('Clipboard access was blocked. Open the link and copy it from the address bar.', 'error');
    }
  };

  const printQr = () => {
    if (!qrState.data) return;
    const win = window.open('', '_blank', 'width=760,height=920');
    if (!win) {
      addToast('Allow pop-ups to print the table QR.', 'error');
      return;
    }
    const title = `Table ${qrState.data.tableNumber} — Apna Order`;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 48px; color: #123c2b; background: #fffaf0; text-align: center; }
        .frame { border: 2px solid #123c2b; border-radius: 24px; padding: 36px; max-width: 560px; margin: 0 auto; }
        .eyebrow { letter-spacing: .22em; text-transform: uppercase; font-size: 11px; color: #b85b32; font-weight: 700; }
        h1 { font-size: 34px; margin: 10px 0 4px; }
        p { font-family: Verdana, sans-serif; font-size: 13px; color: #5c6b62; margin: 4px 0; }
        img { width: 340px; height: 340px; margin: 20px auto 14px; display: block; }
        .url { font-family: monospace; font-size: 10px; word-break: break-all; color: #6b7a72; margin-top: 8px; }
        .footer { margin-top: 22px; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #b85b32; }
        @media print { body { padding: 16px; } .frame { border-width: 1px; } }
      </style></head><body>
      <div class="frame">
        <span class="eyebrow">Scan to order · Apna Order</span>
        <h1>Table ${qrState.data.tableNumber}</h1>
        <p>${qrState.data.label || 'Dining room'}</p>
        <img src="${qrState.data.dataUrl}" alt="QR code for table ${qrState.data.tableNumber}" />
        <p>Point your phone camera at the code to open the table menu.</p>
        <div class="url">${qrState.data.menuUrl}</div>
        <div class="footer">Dine-in ordering · Please ask staff for help</div>
      </div>
      <script>window.onload = function () { window.focus(); window.print(); };</script>
      </body></html>`);
    win.document.close();
  };

  const confirmRotate = async () => {
    if (!rotateTarget) return;
    setBusyId(rotateTarget.id);
    try {
      const data = await api.post(`/admin/tables/${rotateTarget.id}/rotate`);
      setTables((current) =>
        current.map((row) => (row.id === rotateTarget.id ? data.table : row)),
      );
      addToast(
        `Table ${data.table.tableNumber} has a new QR token. The old code is now invalid.`,
        'info',
      );
      setRotateTarget(null);
    } catch (rotateError) {
      addToast(parseApiError(rotateError), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = tables.filter((table) => table.isActive).length;

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Floor plan"
        title="Tables and secure QR codes."
        description="Each table owns a random 256-bit token. Rotating a token invalidates the old printed QR immediately without affecting past orders."
        busy={refreshing}
        onRefresh={() => loadTables()}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={16} /> Add table
          </button>
        }
      />

      <div className="admin-menu-summary">
        <span>
          <Table2 size={16} /> {tables.length} tables configured
        </span>
        <span>
          <span className="status-dot status-dot-green" /> {activeCount} active QR codes
        </span>
        <span>
          <QrCode size={15} /> {tables.length - activeCount} inactive
        </span>
      </div>

      <InlineAlert tone="warning" title="Treat table links like keys">
        <p>
          A table token identifies the table for ordering, payment and billing. Do not post QR codes
          publicly. If a printed code is copied or lost, rotate it here and reprint.
        </p>
      </InlineAlert>

      {error && (
        <ErrorState title="Tables could not load" message={error} onRetry={() => loadTables()} />
      )}

      {loading ? (
        <AdminLoading label="Preparing the floor plan…" rows={4} />
      ) : tables.length === 0 ? (
        <EmptyState
          icon={Table2}
          title="No tables yet"
          message="Create the first table to generate a secure menu link and printable QR code."
          action={
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              <Plus size={16} /> Add table
            </button>
          }
        />
      ) : (
        <div className="admin-table-grid">
          {tables.map((table) => (
            <article className="admin-table-card" key={table.id}>
              <div className="admin-table-card-head">
                <span className="admin-table-number">{String(table.tableNumber).padStart(2, '0')}</span>
                <div>
                  <h3>Table {table.tableNumber}</h3>
                  <p>{table.label || 'Dining room'}</p>
                </div>
                <Badge tone={table.isActive ? 'green' : 'neutral'} dot>
                  {table.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="admin-table-meta">
                <span>Created {formatDateTime(table.createdAt)}</span>
                <span className="mono admin-token-preview">{table.qrToken.slice(0, 18)}…</span>
              </div>

              <div className="admin-table-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => openQr(table)}>
                  <QrCode size={14} /> View QR
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyLink(table)}>
                  <Copy size={14} /> Copy link
                </button>
                <a
                  className="icon-button icon-button-sm"
                  href={table.menuUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open menu for table ${table.tableNumber}`}
                  title="Open guest menu"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  type="button"
                  className="icon-button icon-button-sm"
                  onClick={() => setRotateTarget(table)}
                  aria-label={`Rotate QR for table ${table.tableNumber}`}
                  title="Rotate QR token"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              <div className="admin-table-toggle">
                <Toggle
                  checked={table.isActive}
                  onChange={() => toggleActive(table)}
                  label={table.isActive ? 'Accepting orders' : 'QR disabled'}
                  busy={busyId === table.id}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={saving ? undefined : () => setAddOpen(false)}
        title="Add a table"
        eyebrow="New table"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="admin-table-form" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner size={16} /> : <Plus size={16} />} Create table
            </button>
          </>
        }
      >
        <form id="admin-table-form" className="admin-form" onSubmit={handleAdd}>
          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}
          <div className="field">
            <label htmlFor="table-number">Table number</label>
            <input
              id="table-number"
              type="number"
              min="1"
              max="999"
              value={form.tableNumber}
              onChange={(event) => setForm({ ...form, tableNumber: event.target.value })}
              required
            />
            <small className="field-hint">Unique on the floor. Used on kitchen tickets and bills.</small>
          </div>
          <div className="field">
            <label htmlFor="table-label">Label (optional)</label>
            <input
              id="table-label"
              type="text"
              maxLength={80}
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="e.g. Window seat, Terrace 2"
            />
          </div>
          <InlineAlert tone="info" title="A secure token is generated automatically">
            <p>
              The QR encodes a random token, not the table number. Guests cannot guess another table
              by editing the URL.
            </p>
          </InlineAlert>
        </form>
      </Modal>

      <Modal
        open={qrState.open}
        onClose={() => setQrState({ open: false, loading: false, data: null, table: null })}
        title={qrState.data ? `Table ${qrState.data.tableNumber} QR` : 'Table QR'}
        eyebrow="Guest menu link"
        size="md"
        className="qr-modal"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setQrState({ open: false, loading: false, data: null, table: null })}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => qrState.data && copyLink({ menuUrl: qrState.data.menuUrl })}
              disabled={!qrState.data}
            >
              <Copy size={15} /> Copy link
            </button>
            <button type="button" className="btn btn-outline" onClick={printQr} disabled={!qrState.data}>
              <Printer size={15} /> Print
            </button>
            <a
              className="btn btn-outline"
              href={qrState.data?.dataUrl || '#'}
              download={`apna-order-table-${qrState.data?.tableNumber || ''}.png`}
              onClick={(event) => !qrState.data && event.preventDefault()}
            >
              <Download size={15} /> PNG
            </a>
          </>
        }
      >
        {qrState.loading || !qrState.data ? (
          <div className="admin-loading">
            <div className="admin-loading-head">
              <Spinner size={18} /> Generating the QR code…
            </div>
          </div>
        ) : (
          <div className="qr-preview">
            <div className="qr-preview-frame">
              <img src={qrState.data.dataUrl} alt={`QR code for table ${qrState.data.tableNumber}`} />
            </div>
            <div className="qr-preview-copy">
              <Badge tone={qrState.data.isActive ? 'green' : 'neutral'} dot>
                {qrState.data.isActive ? 'Active table' : 'Inactive table'}
              </Badge>
              <h3>Table {qrState.data.tableNumber}</h3>
              <p>{qrState.data.label || 'Dining room'}</p>
              <span className="qr-url mono">{qrState.data.menuUrl}</span>
              <InlineAlert tone={qrState.data.isActive ? 'info' : 'warning'} title="Print guidance">
                <p>
                  {qrState.data.isActive
                    ? 'Print on matte paper at 100% scale. Test the code with a phone before placing it on the table.'
                    : 'This table is inactive. Guests scanning this code will be told to ask staff for a fresh QR.'}
                </p>
              </InlineAlert>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onClose={() => setRotateTarget(null)}
        onConfirm={confirmRotate}
        title="Rotate this table QR?"
        message={`Any printed QR for table ${rotateTarget?.tableNumber || ''} will stop working immediately. Existing orders and payments are untouched. Print and place the new code before guests arrive.`}
        confirmLabel="Rotate token"
        danger
        busy={busyId === rotateTarget?.id}
      />

      <div className="admin-security-strip">
        <ShieldAlert size={16} />
        <span>
          QR rotation is audited. Inactive tokens are rejected by the API before any menu, order or
          payment action is allowed.
        </span>
        <button type="button" className="text-button" onClick={() => loadTables()}>
          <RefreshCw size={14} /> Sync floor plan
        </button>
      </div>
    </div>
  );
}
