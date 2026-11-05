import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Eye,
  IndianRupee,
  RefreshCw,
  RotateCw,
  Search,
  TestTube2,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { AdminLoading, AdminSectionHeader, FilterSelect } from './shared.jsx';
import {
  Badge,
  EmptyState,
  ErrorState,
  InlineAlert,
  Modal,
  Spinner,
} from '../ui.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  formatDateTime,
  formatMoney,
  parseApiError,
  paymentRecordMeta,
  rupeesToPaise,
} from '../../utils/format.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All records' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partly refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CREATED', label: 'Created' },
  { value: 'FAILED', label: 'Failed' },
];

const PROVIDER_OPTIONS = [
  { value: '', label: 'All providers' },
  { value: 'simulated', label: 'Simulated (dev)' },
  { value: 'razorpay', label: 'Razorpay' },
];

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `refund:${crypto.randomUUID()}`;
  return `refund:${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function AdminPayments({ onNavigate }) {
  const { addToast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [refundForm, setRefundForm] = useState({ amount: '', reason: '', key: '' });
  const [refundError, setRefundError] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [reconcilingId, setReconcilingId] = useState(null);

  const loadPayments = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.get('/admin/payments?limit=200');
      setPayments(data.payments);
      setError('');
    } catch (loadError) {
      setError(parseApiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payments.filter((payment) => {
      if (status && payment.status !== status) return false;
      if (provider && payment.provider !== provider) return false;
      if (
        term &&
        !`${payment.orderPublicId} ${payment.customerName} ${payment.providerPaymentId || ''} ${
          payment.tableNumber
        }`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      return true;
    });
  }, [payments, status, provider, search]);

  const totals = useMemo(() => {
    const collected = payments
      .filter((payment) => ['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status))
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    const refunded = payments.reduce((sum, payment) => sum + payment.refundedPaise, 0);
    const pending = payments.filter((payment) =>
      ['CREATED', 'PENDING'].includes(payment.status),
    ).length;
    const simulated = payments
      .filter((payment) => payment.isSimulated && payment.status === 'PAID')
      .reduce((sum, payment) => sum + payment.amountPaise, 0);
    return { collected, refunded, pending, simulated };
  }, [payments]);

  const openPayment = (payment) => {
    setSelected(payment);
    setRefundForm({
      amount: ((payment.amountPaise - payment.refundedPaise) / 100).toFixed(2),
      reason: '',
      key: makeIdempotencyKey(),
    });
    setRefundError('');
  };

  const closePayment = () => {
    if (refunding) return;
    setSelected(null);
    setRefundError('');
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const amountPaise = rupeesToPaise(refundForm.amount);
    const remaining = selected.amountPaise - selected.refundedPaise;
    if (!Number.isInteger(amountPaise) || amountPaise < 1) {
      setRefundError('Enter a refund amount of at least ₹0.01.');
      return;
    }
    if (amountPaise > remaining) {
      setRefundError(`The maximum refundable amount is ${formatMoney(remaining)}.`);
      return;
    }
    if (refundForm.reason.trim().length < 3) {
      setRefundError('Add a reason of at least three characters. It is written to the audit log.');
      return;
    }
    setRefunding(true);
    setRefundError('');
    try {
      const result = await api.post(
        `/admin/payments/${selected.id}/refund`,
        { amountPaise, reason: refundForm.reason.trim() },
        { 'Idempotency-Key': refundForm.key },
      );
      addToast(
        result.duplicate
          ? 'This refund was already recorded — idempotency prevented a duplicate.'
          : selected.isSimulated
            ? 'Simulated refund recorded. No real money moved.'
            : 'Refund received by the gateway and recorded.',
        'success',
      );
      setSelected(null);
      await loadPayments(true);
    } catch (refundFailure) {
      setRefundError(parseApiError(refundFailure));
    } finally {
      setRefunding(false);
    }
  };

  const reconcile = async (payment) => {
    setReconcilingId(payment.id);
    try {
      const result = await api.post(`/admin/payments/${payment.id}/reconcile`);
      const messages = {
        marked_paid: 'Gateway confirmed a captured payment. The order is now paid.',
        marked_failed: 'Gateway confirmed the attempt failed. The order is unpaid again.',
        still_pending: 'The gateway still reports no captured payment. Nothing changed.',
        already_paid: 'This payment was already recorded as paid.',
      };
      addToast(messages[result.action] || 'Reconciliation finished.', 'info');
      await loadPayments(true);
    } catch (reconcileError) {
      addToast(parseApiError(reconcileError), 'error');
    } finally {
      setReconcilingId(null);
    }
  };

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Settlement desk"
        title="Payments, refunds and reconciliation."
        description="Only gateway-verified records can become paid. Refunds are reserved against the captured amount and every attempt is idempotent."
        busy={refreshing}
        onRefresh={() => loadPayments()}
        actions={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('orders')}>
            <IndianRupee size={15} /> Order ledger
          </button>
        }
      />

      <div className="admin-payment-stats">
        <div>
          <span>Collected</span>
          <strong>{formatMoney(totals.collected)}</strong>
          <small>Paid and partly refunded captures</small>
        </div>
        <div>
          <span>Refunded</span>
          <strong>{formatMoney(totals.refunded)}</strong>
          <small>Processed refunds only</small>
        </div>
        <div>
          <span>Awaiting confirmation</span>
          <strong>{totals.pending}</strong>
          <small>Created or pending attempts</small>
        </div>
        <div>
          <span>Simulated captures</span>
          <strong>{formatMoney(totals.simulated)}</strong>
          <small>Development records, no money moved</small>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="search-box admin-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, guest, payment ID…"
            aria-label="Search payments"
          />
        </div>
        <FilterSelect
          id="payments-status"
          label="Record status"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          id="payments-provider"
          label="Provider"
          value={provider}
          onChange={setProvider}
          options={PROVIDER_OPTIONS}
        />
      </div>

      {error && (
        <ErrorState
          title="Payments could not load"
          message={error}
          onRetry={() => loadPayments()}
        />
      )}

      {loading ? (
        <AdminLoading label="Reconciling the settlement ledger…" rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment records match"
          message="Payment attempts appear here as soon as a guest starts checkout."
        />
      ) : (
        <div className="admin-panel admin-panel-list">
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-payments">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Order</th>
                  <th>Guest</th>
                  <th>Amount</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Verified via</th>
                  <th>Refunded</th>
                  <th>Paid at</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => {
                  const meta = paymentRecordMeta(payment.status);
                  const canRefund = ['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status);
                  const canReconcile =
                    payment.provider === 'razorpay' &&
                    ['CREATED', 'PENDING'].includes(payment.status);
                  return (
                    <tr key={payment.id}>
                      <td className="mono">#{payment.id}</td>
                      <td>
                        <span className="admin-table-strong mono">{payment.orderPublicId}</span>
                        <small>Table {payment.tableNumber}</small>
                      </td>
                      <td>{payment.customerName}</td>
                      <td className="admin-money">{formatMoney(payment.amountPaise)}</td>
                      <td>
                        <Badge tone={payment.isSimulated ? 'amber' : 'blue'}>
                          {payment.isSimulated ? <TestTube2 size={12} /> : <CreditCard size={12} />}
                          {payment.isSimulated ? 'Simulated' : 'Razorpay'}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={meta.tone} dot>
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="admin-muted">
                        {payment.verifiedVia?.replaceAll('_', ' ') || 'Not verified'}
                      </td>
                      <td className="admin-money">
                        {payment.refundedPaise > 0 ? formatMoney(payment.refundedPaise) : '—'}
                      </td>
                      <td className="admin-muted">
                        {payment.paidAt ? formatDateTime(payment.paidAt) : '—'}
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="icon-button icon-button-sm"
                            onClick={() => openPayment(payment)}
                            aria-label={`View payment ${payment.id}`}
                            title="View payment"
                          >
                            <Eye size={16} />
                          </button>
                          {canReconcile && (
                            <button
                              type="button"
                              className="icon-button icon-button-sm"
                              onClick={() => reconcile(payment)}
                              disabled={reconcilingId === payment.id}
                              aria-label={`Reconcile payment ${payment.id}`}
                              title="Reconcile with Razorpay"
                            >
                              {reconcilingId === payment.id ? (
                                <Spinner size={15} />
                              ) : (
                                <RotateCw size={16} />
                              )}
                            </button>
                          )}
                          {canRefund && (
                            <button
                              type="button"
                              className="icon-button icon-button-sm"
                              onClick={() => openPayment(payment)}
                              aria-label={`Refund payment ${payment.id}`}
                              title="Refund"
                            >
                              <Undo2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InlineAlert tone="info" title="How settlement is verified">
        <p>
          A paid record requires a verified checkout signature plus a captured gateway payment, a
          signature-checked webhook, or an authenticated reconciliation that finds a captured payment
          for the exact amount. A browser redirect, screenshot or QR scan alone never changes the
          payment status.
        </p>
      </InlineAlert>

      <Modal
        open={Boolean(selected)}
        onClose={refunding ? undefined : closePayment}
        title={selected ? `Payment #${selected.id}` : 'Payment'}
        eyebrow={selected ? selected.orderPublicId : 'Payment record'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closePayment} disabled={refunding}>
              Close
            </button>
            {selected &&
              selected.provider === 'razorpay' &&
              ['CREATED', 'PENDING'].includes(selected.status) && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => reconcile(selected)}
                  disabled={reconcilingId === selected.id}
                >
                  {reconcilingId === selected.id ? <Spinner size={15} /> : <RotateCw size={15} />}
                  Reconcile now
                </button>
              )}
          </>
        }
      >
        {selected && (
          <div className="admin-payment-detail">
            <div className="admin-payment-detail-top">
              <div className={`admin-payment-amount ${selected.isSimulated ? 'is-simulated' : ''}`}>
                <span>{selected.isSimulated ? 'Simulated amount' : 'Captured amount'}</span>
                <strong>{formatMoney(selected.amountPaise)}</strong>
                <small>Refunded {formatMoney(selected.refundedPaise)}</small>
              </div>
              <div className="admin-payment-facts">
                <div>
                  <span>Order</span>
                  <strong className="mono">{selected.orderPublicId}</strong>
                </div>
                <div>
                  <span>Table / guest</span>
                  <strong>
                    {selected.tableNumber} · {selected.customerName}
                  </strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{selected.isSimulated ? 'Simulated (development)' : 'Razorpay'}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <Badge tone={paymentRecordMeta(selected.status).tone} dot>
                    {paymentRecordMeta(selected.status).label}
                  </Badge>
                </div>
                <div>
                  <span>Verification</span>
                  <strong>{selected.verifiedVia?.replaceAll('_', ' ') || 'Not verified'}</strong>
                </div>
                <div>
                  <span>Gateway payment ID</span>
                  <strong className="mono">{selected.providerPaymentId || '—'}</strong>
                </div>
                <div>
                  <span>Paid at</span>
                  <strong>{selected.paidAt ? formatDateTime(selected.paidAt) : '—'}</strong>
                </div>
                <div>
                  <span>Order created</span>
                  <strong>{formatDateTime(selected.orderCreatedAt)}</strong>
                </div>
              </div>
            </div>

            {selected.isSimulated && (
              <InlineAlert tone="warning" title="Development simulation" icon={TestTube2}>
                <p>
                  This record was created by the local simulation flow. It is evidence that the
                  application flow works, not that money moved. Real gateway credentials are never
                  invented or stored in source.
                </p>
              </InlineAlert>
            )}

            {selected.failureReason && (
              <InlineAlert tone="danger" title="Gateway failure reason" icon={TriangleAlert}>
                <p>{selected.failureReason}</p>
              </InlineAlert>
            )}

            {['PAID', 'PARTIALLY_REFUNDED'].includes(selected.status) ? (
              <form className="admin-refund-form" onSubmit={submitRefund}>
                <div className="admin-refund-head">
                  <span className="admin-refund-icon">
                    <Undo2 size={18} />
                  </span>
                  <div>
                    <h4>Record a refund</h4>
                    <p>
                      Remaining refundable: <strong>{formatMoney(selected.amountPaise - selected.refundedPaise)}</strong>
                    </p>
                  </div>
                </div>
                {refundError && (
                  <div className="form-error" role="alert">
                    {refundError}
                  </div>
                )}
                <div className="form-grid-two">
                  <div className="field">
                    <label htmlFor="refund-amount">Amount (₹)</label>
                    <input
                      id="refund-amount"
                      type="number"
                      min="0.01"
                      max={(selected.amountPaise - selected.refundedPaise) / 100}
                      step="0.01"
                      value={refundForm.amount}
                      onChange={(event) =>
                        setRefundForm({ ...refundForm, amount: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="refund-reason">Reason</label>
                    <input
                      id="refund-reason"
                      type="text"
                      minLength={3}
                      maxLength={200}
                      value={refundForm.reason}
                      onChange={(event) =>
                        setRefundForm({ ...refundForm, reason: event.target.value })
                      }
                      placeholder="e.g. Wrong dish served"
                      required
                    />
                  </div>
                </div>
                <div className="admin-refund-actions">
                  <span className="field-hint">
                    Idempotency key <code className="mono">{refundForm.key.slice(0, 22)}…</code>
                  </span>
                  <button type="submit" className="btn btn-danger btn-sm" disabled={refunding}>
                    {refunding ? <Spinner size={15} /> : <Banknote size={15} />}
                    {selected.isSimulated ? 'Record simulated refund' : 'Refund via gateway'}
                  </button>
                </div>
              </form>
            ) : (
              <InlineAlert tone="info" title="Refunds are available after capture">
                <p>
                  This record is not in a captured state. A refund can only be recorded against a paid
                  or partly refunded payment.
                </p>
              </InlineAlert>
            )}

            {selected.refunds?.length > 0 && (
              <div className="admin-refund-history">
                <h4>
                  <CheckCircle2 size={16} /> Refund history
                </h4>
                {selected.refunds.map((refund) => (
                  <div className="admin-refund-row" key={refund.id}>
                    <div>
                      <strong>{formatMoney(refund.amountPaise)}</strong>
                      <small>{refund.reason}</small>
                    </div>
                    <Badge tone={refund.status === 'PROCESSED' ? 'green' : 'amber'}>
                      {refund.status}
                    </Badge>
                    <span className="mono">{refund.providerRefundId || 'Local record'}</span>
                    <span className="admin-muted">{formatDateTime(refund.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-detail-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  closePayment();
                  onNavigate('orders');
                }}
              >
                <RefreshCw size={15} /> Back to order ledger
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
