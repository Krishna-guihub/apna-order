import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  ClipboardList,
  Eye,
  IndianRupee,
  RefreshCw,
  Search,
  Undo2,
} from 'lucide-react';
import { AdminLoading, AdminSectionHeader, FilterSelect } from './shared.jsx';
import {
  Badge,
  EmptyState,
  ErrorState,
  InlineAlert,
  Modal,
  PaymentBadge,
  Spinner,
  StatusBadge,
} from '../ui.jsx';
import { api, qs } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  classNames,
  formatDateTime,
  formatMoney,
  parseApiError,
  paymentRecordMeta,
  rupeesToPaise,
} from '../../utils/format.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All kitchen states' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'SERVED', label: 'Served' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PAYMENT_OPTIONS = [
  { value: '', label: 'All payment states' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PAYMENT_PENDING', label: 'Payment pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partly refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const RECONCILE_TARGET = { value: 'reconcile', label: 'Payment console' };

export default function AdminOrders({ onNavigate }) {
  const { addToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [discountForm, setDiscountForm] = useState({ discount: '', reason: '' });
  const [discountError, setDiscountError] = useState('');
  const [discounting, setDiscounting] = useState(false);

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const data = await api.get(
          `/admin/orders${qs({ status, paymentStatus, limit: 200 })}`,
        );
        setOrders(data.orders);
        setError('');
      } catch (loadError) {
        setError(parseApiError(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [status, paymentStatus],
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) =>
      `${order.publicId} ${order.customerName} ${order.table.tableNumber} ${order.table.label}`
        .toLowerCase()
        .includes(term),
    );
  }, [orders, search]);

  const openDetail = async (order) => {
    setDetail(order);
    setDetailLoading(true);
    setDiscountForm({ discount: '', reason: '' });
    setDiscountError('');
    try {
      const data = await api.get(`/admin/orders/${order.publicId}`);
      setDetail(data.order);
    } catch (detailError) {
      addToast(parseApiError(detailError), 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDiscountError('');
  };

  const applyDiscount = async (event) => {
    event.preventDefault();
    if (!detail) return;
    const discountPaise = rupeesToPaise(discountForm.discount);
    if (discountPaise <= 0) {
      setDiscountError('Enter a discount amount greater than zero.');
      return;
    }
    if (discountPaise > detail.subtotalPaise) {
      setDiscountError('Discount cannot exceed the order subtotal.');
      return;
    }
    if (discountForm.reason.trim().length < 3) {
      setDiscountError('Add a short reason for the audit log.');
      return;
    }
    setDiscounting(true);
    setDiscountError('');
    try {
      const data = await api.patch(`/admin/orders/${detail.publicId}/discount`, {
        discountPaise,
        reason: discountForm.reason.trim(),
      });
      setDetail(data.order);
      setDiscountForm({ discount: '', reason: '' });
      addToast(`Discount applied to ${data.order.publicId}.`, 'success');
      await loadOrders(true);
    } catch (discountFailure) {
      setDiscountError(parseApiError(discountFailure));
    } finally {
      setDiscounting(false);
    }
  };

  const canDiscount =
    detail &&
    detail.paymentStatus === 'UNPAID' &&
    !detail.payment &&
    detail.status !== 'CANCELLED';

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Order ledger"
        title="Every table order, one clear record."
        description="Audit the full order lifecycle, inspect server-calculated bills and apply pre-payment discounts with a recorded reason."
        busy={refreshing}
        onRefresh={() => loadOrders()}
        actions={
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('payments')}>
            <IndianRupee size={15} /> Payments
          </button>
        }
      />

      <div className="admin-toolbar">
        <div className="search-box admin-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order ID, guest, table…"
            aria-label="Search orders"
          />
        </div>
        <FilterSelect
          id="orders-status"
          label="Kitchen state"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          id="orders-payment"
          label="Payment state"
          value={paymentStatus}
          onChange={setPaymentStatus}
          options={PAYMENT_OPTIONS}
        />
        <span className="admin-toolbar-count">
          {filtered.length} of {orders.length} orders
        </span>
      </div>

      {error && (
        <ErrorState title="Orders could not load" message={error} onRetry={() => loadOrders()} />
      )}

      {loading ? (
        <AdminLoading label="Reading the order ledger…" rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders match"
          message="Change the filters or place a demo order from a table menu to populate the ledger."
        />
      ) : (
        <div className="admin-panel admin-panel-list">
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-orders">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Table</th>
                  <th>Guest</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Kitchen</th>
                  <th>Settlement</th>
                  <th>Placed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.publicId}>
                    <td className="mono admin-table-strong">{order.publicId}</td>
                    <td>
                      <span className="admin-table-strong">Table {order.table.tableNumber}</span>
                      <small>{order.table.label || 'Dining room'}</small>
                    </td>
                    <td>
                      <span className="admin-table-strong">{order.customerName}</span>
                      <small>{order.customerPhone || 'No phone'}</small>
                    </td>
                    <td>
                      <span className="admin-table-strong">
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </span>
                      <small>{order.items.length} lines</small>
                    </td>
                    <td className="admin-money">{formatMoney(order.totalPaise)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      <PaymentBadge status={order.paymentStatus} />
                    </td>
                    <td className="admin-muted">{formatDateTime(order.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button icon-button-sm"
                        onClick={() => openDetail(order)}
                        aria-label={`View order ${order.publicId}`}
                        title="View order"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-note-grid">
        <div className="admin-note-card">
          <Badge tone="amber">Discount rule</Badge>
          <h3>Before money moves only</h3>
          <p>
            A discount is allowed only while the order is unpaid and no payment attempt exists. The
            server recalculates tax and total from the discounted subtotal.
          </p>
        </div>
        <div className="admin-note-card">
          <Badge tone="green">Settlement rule</Badge>
          <h3>Paid orders need a refund first</h3>
          <p>
            Cancelling a paid order is blocked until its payment is fully refunded. This keeps kitchen
            state and settlement state in agreement.
          </p>
        </div>
        <div className="admin-note-card">
          <Badge tone="blue">Audit rule</Badge>
          <h3>Every change leaves a trace</h3>
          <p>
            Status updates, discounts, refunds and QR rotations are recorded with actor, role and
            metadata in the audit log.
          </p>
        </div>
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={detailLoading ? undefined : closeDetail}
        title={detail ? `Order ${detail.publicId}` : 'Order detail'}
        eyebrow={detail ? `Table ${detail.table.tableNumber} · ${detail.customerName}` : 'Order'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeDetail} disabled={detailLoading}>
              Close
            </button>
            <button type="button" className="btn btn-outline" onClick={() => loadOrders()}>
              <RefreshCw size={15} /> Refresh ledger
            </button>
          </>
        }
      >
        {detailLoading || !detail ? (
          <div className="admin-loading">
            <div className="admin-loading-head">
              <Spinner size={18} /> Loading the order…
            </div>
          </div>
        ) : (
          <div className="admin-order-detail">
            <div className="admin-order-detail-top">
              <div>
                <Badge tone="neutral">{formatDateTime(detail.createdAt)}</Badge>
                <h3>
                  Table {detail.table.tableNumber} · {detail.table.label || 'Dining room'}
                </h3>
                <p>
                  {detail.customerName}
                  {detail.customerPhone ? ` · ${detail.customerPhone}` : ''}
                </p>
              </div>
              <div className="admin-order-statuses">
                <StatusBadge status={detail.status} detailed />
                <PaymentBadge status={detail.paymentStatus} detailed />
              </div>
            </div>

            {detail.notes && (
              <div className="admin-order-note">
                <span>Kitchen note</span>
                <p>{detail.notes}</p>
              </div>
            )}

            <div className="admin-order-items">
              <div className="admin-order-items-head">
                <span>Item</span>
                <span>Qty</span>
                <span>Amount</span>
              </div>
              {detail.items.map((item) => (
                <div className="admin-order-item" key={item.id}>
                  <div>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{formatMoney(item.unitPricePaise)} each</small>
                    </span>
                  </div>
                  <span>{item.quantity}</span>
                  <strong>{formatMoney(item.lineTotalPaise)}</strong>
                </div>
              ))}
            </div>

            <div className="admin-order-totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatMoney(detail.subtotalPaise)}</strong>
              </div>
              {detail.discountPaise > 0 && (
                <div>
                  <span>Discount {detail.discountReason ? `· ${detail.discountReason}` : ''}</span>
                  <strong>−{formatMoney(detail.discountPaise)}</strong>
                </div>
              )}
              <div>
                <span>Tax ({detail.taxRatePercent}%)</span>
                <strong>{formatMoney(detail.taxPaise)}</strong>
              </div>
              <div className="admin-order-grand">
                <span>Total</span>
                <strong>{formatMoney(detail.totalPaise)}</strong>
              </div>
            </div>

            {detail.payment ? (
              <div className="admin-payment-summary">
                <div>
                  <span>Payment record</span>
                  <strong>
                    {detail.payment.isSimulated ? 'Simulated (development)' : detail.payment.provider}
                  </strong>
                </div>
                <div>
                  <span>Record status</span>
                  <Badge tone={paymentRecordMeta(detail.payment.status).tone}>
                    {paymentRecordMeta(detail.payment.status).label}
                  </Badge>
                </div>
                <div>
                  <span>Verified via</span>
                  <strong>{detail.payment.verifiedVia?.replaceAll('_', ' ') || 'Not verified'}</strong>
                </div>
                <div>
                  <span>Refunded</span>
                  <strong>{formatMoney(detail.payment.refundedPaise)}</strong>
                </div>
              </div>
            ) : (
              <InlineAlert tone="info" title="No payment attempt yet">
                <p>
                  The guest has not started a payment for this order. A pre-payment discount can be
                  applied below.
                </p>
              </InlineAlert>
            )}

            {canDiscount && (
              <form className="admin-discount-form" onSubmit={applyDiscount}>
                <div className="admin-discount-head">
                  <span className="admin-discount-icon">
                    <BadgePercent size={18} />
                  </span>
                  <div>
                    <h4>Apply a discount</h4>
                    <p>Tax is recalculated on the discounted subtotal by the server.</p>
                  </div>
                </div>
                {discountError && (
                  <div className="form-error" role="alert">
                    {discountError}
                  </div>
                )}
                <div className="form-grid-two">
                  <div className="field">
                    <label htmlFor="discount-amount">Discount (₹)</label>
                    <input
                      id="discount-amount"
                      type="number"
                      min="0.01"
                      max={detail.subtotalPaise / 100}
                      step="0.01"
                      value={discountForm.discount}
                      onChange={(event) =>
                        setDiscountForm({ ...discountForm, discount: event.target.value })
                      }
                      placeholder="e.g. 100"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="discount-reason">Reason</label>
                    <input
                      id="discount-reason"
                      type="text"
                      minLength={3}
                      maxLength={200}
                      value={discountForm.reason}
                      onChange={(event) =>
                        setDiscountForm({ ...discountForm, reason: event.target.value })
                      }
                      placeholder="e.g. Loyalty gesture"
                      required
                    />
                  </div>
                </div>
                <div className="admin-discount-actions">
                  <span className="field-hint">Maximum ₹{(detail.subtotalPaise / 100).toFixed(2)}</span>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={discounting}>
                    {discounting ? <Spinner size={15} /> : <BadgePercent size={15} />} Apply discount
                  </button>
                </div>
              </form>
            )}

            {detail.status === 'CANCELLED' && detail.paymentStatus === 'PAID' && (
              <InlineAlert tone="warning" title="Refund required">
                <p>
                  This paid order is cancelled but still holds a captured payment. Open the payments
                  console to record the refund.
                </p>
              </InlineAlert>
            )}

            <div className="admin-detail-actions">
              {['PAID', 'PARTIALLY_REFUNDED'].includes(detail.paymentStatus) && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    closeDetail();
                    onNavigate('payments');
                  }}
                >
                  <Undo2 size={15} /> Refund in payments console
                </button>
              )}
              <span className="admin-detail-note">
                Receipts are shared by the guest from their own order page. Staff never send WhatsApp
                messages automatically.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
