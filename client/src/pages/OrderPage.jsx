import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  ClipboardList,
  Hourglass,
  MessageCircle,
  Printer,
  RefreshCw,
  Utensils,
  XCircle,
} from 'lucide-react';
import SiteHeader from '../components/SiteHeader.jsx';
import PaymentPanel from '../components/PaymentPanel.jsx';
import {
  ConfirmDialog,
  ErrorState,
  InlineAlert,
  Skeleton,
  Spinner,
  StatusBadge,
  VegMark,
} from '../components/ui.jsx';
import { api } from '../api/client.js';
import { usePolling } from '../hooks/usePolling.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  classNames,
  elapsedLabel,
  formatDateTime,
  formatMoney,
  parseApiError,
  statusMeta,
} from '../utils/format.js';

const STAGES = ['PLACED', 'PREPARING', 'READY', 'SERVED'];

const STATUS_HERO = {
  PLACED: {
    icon: ClipboardList,
    title: 'Your order is with the kitchen.',
    copy: 'The team has received your table order. Sit back — we’ll keep this page updated.',
  },
  PREPARING: {
    icon: ChefHat,
    title: 'Your food is being prepared.',
    copy: 'The kitchen is working on your order right now. You can follow each step here.',
  },
  READY: {
    icon: BellRing,
    title: 'Your order is ready.',
    copy: 'It’s on its way to your table. Please make a little room and enjoy.',
  },
  SERVED: {
    icon: Utensils,
    title: 'Served. Enjoy your meal.',
    copy: 'Your order has reached the table. The itemised bill is below whenever you’re ready.',
  },
  CANCELLED: {
    icon: XCircle,
    title: 'This order was cancelled.',
    copy: 'No further kitchen action will be taken. If you were charged, restaurant staff can process a refund.',
  },
};

export default function OrderPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const location = useLocation();
  const { addToast } = useToast();
  const publicId = location.pathname.split('/').filter(Boolean).pop();
  const [order, setOrder] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [waOpened, setWaOpened] = useState(false);
  const [waConfirmed, setWaConfirmed] = useState(false);

  const loadOrder = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setRefreshing(true);
      try {
        const data = await api.get(
          `/public/orders/${publicId}?tableToken=${encodeURIComponent(token)}`,
        );
        setOrder(data.order);
        setError(null);
      } catch (loadError) {
        if (!silent) setError(loadError);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [publicId, token],
  );

  useEffect(() => {
    api
      .get('/public/config')
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!token) {
      setError(new Error('The table token is missing from this order link.'));
      setLoading(false);
      return;
    }
    loadOrder();
  }, [token, loadOrder]);

  usePolling(() => loadOrder(true), 5000, Boolean(token));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const data = await api.post(`/public/orders/${publicId}/cancel`, { tableToken: token });
      setOrder(data.order);
      setConfirmCancel(false);
      addToast('Order cancelled. The kitchen has been informed.', 'info');
    } catch (cancelError) {
      addToast(parseApiError(cancelError), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const openWhatsApp = async () => {
    try {
      const result = await api.get(
        `/public/orders/${publicId}/whatsapp-receipt?tableToken=${encodeURIComponent(token)}`,
      );
      window.open(result.url, '_blank', 'noopener,noreferrer');
      setWaOpened(true);
      setWaConfirmed(false);
      addToast('WhatsApp opened. Press Send there manually.', 'info');
    } catch (whatsappError) {
      addToast(parseApiError(whatsappError), 'error');
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <SiteHeader variant="cream" />
        <div className="shell order-loading">
          <Skeleton className="skeleton-line-lg" />
          <div className="order-layout">
            <Skeleton className="skeleton-panel" />
            <Skeleton className="skeleton-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-page">
        <SiteHeader variant="cream" />
        <div className="shell error-page-wrap">
          <ErrorState
            title="We couldn’t open this order"
            message={
              token
                ? parseApiError(error)
                : 'This order link is missing its table token. Scan the table QR code again.'
            }
            onRetry={() => loadOrder()}
          />
          <Link to="/" className="btn btn-outline">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  const hero = STATUS_HERO[order.status] || STATUS_HERO.PLACED;
  const HeroIcon = hero.icon;
  const stageIndex = STAGES.indexOf(order.status);
  const justPlaced = location.state?.justPlaced;
  const menuPath = `/t/${token}`;

  return (
    <div className="order-page">
      <SiteHeader variant="cream" />

      <header className="customer-bar order-customer-bar">
        <div className="shell customer-bar-inner">
          <div className="customer-table-info">
            <span className="table-chip">
              <span className="pulse-dot" /> Table {order.table.tableNumber}
            </span>
            <span className="table-label">{order.publicId}</span>
          </div>
          <div className="order-bar-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => loadOrder()}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
            </button>
            <Link to={menuPath} className="btn btn-outline btn-sm">
              <ArrowLeft size={15} /> Menu
            </Link>
          </div>
        </div>
      </header>

      <main className="shell order-main">
        {justPlaced && (
          <div className="order-success-banner">
            <CheckCircle2 size={22} />
            <div>
              <strong>Order sent to the kitchen.</strong>
              <span>Keep this page open to follow preparation and settle the bill.</span>
            </div>
          </div>
        )}

        <section className={classNames('order-status-hero', `status-hero-${order.status.toLowerCase()}`)}>
          <div className="status-hero-icon">
            <HeroIcon size={30} />
          </div>
          <div className="status-hero-copy">
            <span className="eyebrow">Order {order.publicId}</span>
            <h1>{hero.title}</h1>
            <p>{hero.copy}</p>
          </div>
          <div className="status-hero-side">
            <StatusBadge status={order.status} detailed />
            <span className="elapsed-badge">
              <Hourglass size={15} /> {elapsedLabel(order.createdAt, now)} ago
            </span>
          </div>
        </section>

        {order.status !== 'CANCELLED' && (
          <section className="order-progress" aria-label="Order progress">
            {STAGES.map((stage, index) => {
              const complete = index <= stageIndex;
              const current = index === stageIndex;
              return (
                <div
                  className={classNames('progress-step', complete && 'complete', current && 'current')}
                  key={stage}
                >
                  <span className="progress-dot">{complete ? <CheckCircle2 size={15} /> : index + 1}</span>
                  <div>
                    <strong>{statusMeta(stage).label}</strong>
                    <small>
                      {stage === 'PLACED'
                        ? 'Kitchen received'
                        : stage === 'PREPARING'
                          ? 'On the pass'
                          : stage === 'READY'
                            ? 'Coming to you'
                            : 'Enjoy'}
                    </small>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {order.status === 'CANCELLED' && (
          <InlineAlert tone="warning" title="Order cancelled">
            <p>
              This order is closed. If a verified payment exists, the restaurant can process a refund
              from the admin console; the payment status will update only after the gateway or
              authenticated refund flow confirms it.
            </p>
          </InlineAlert>
        )}

        <div className="order-layout">
          <div className="order-main-column">
            <section className="order-detail-card print-area" id="printable-receipt">
              <div className="receipt-brand">
                <div>
                  <span className="eyebrow">Apna Order · Dine-in bill</span>
                  <h2>Your order</h2>
                </div>
                <div className="receipt-brand-mark" aria-hidden="true">
                  AO
                </div>
              </div>

              <div className="receipt-meta-grid">
                <div>
                  <span>Order ID</span>
                  <strong>{order.publicId}</strong>
                </div>
                <div>
                  <span>Table</span>
                  <strong>
                    {order.table.tableNumber} · {order.table.label || 'Dining room'}
                  </strong>
                </div>
                <div>
                  <span>Placed</span>
                  <strong>{formatDateTime(order.createdAt)}</strong>
                </div>
                <div>
                  <span>Guest</span>
                  <strong>{order.customerName}</strong>
                </div>
              </div>

              <div className="receipt-items">
                <div className="receipt-items-head">
                  <span>Item</span>
                  <span>Qty</span>
                  <span>Amount</span>
                </div>
                {order.items.map((item) => (
                  <div className="receipt-item" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{formatMoney(item.unitPricePaise)} each</small>
                    </div>
                    <span>{item.quantity}</span>
                    <strong>{formatMoney(item.lineTotalPaise)}</strong>
                  </div>
                ))}
              </div>

              {order.notes && (
                <div className="receipt-notes">
                  <span>Kitchen note</span>
                  <p>{order.notes}</p>
                </div>
              )}

              <div className="receipt-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(order.subtotalPaise)}</strong>
                </div>
                {order.discountPaise > 0 && (
                  <div>
                    <span>Discount {order.discountReason ? `(${order.discountReason})` : ''}</span>
                    <strong>−{formatMoney(order.discountPaise)}</strong>
                  </div>
                )}
                <div>
                  <span>Tax ({order.taxRatePercent}%)</span>
                  <strong>{formatMoney(order.taxPaise)}</strong>
                </div>
                <div className="receipt-grand-total">
                  <span>Total</span>
                  <strong>{formatMoney(order.totalPaise)}</strong>
                </div>
              </div>

              <div className="receipt-footer">
                <span>{order.paymentStatus === 'PAID' ? 'PAID' : order.paymentStatus.replaceAll('_', ' ')}</span>
                <span>Thank you for dining with us.</span>
              </div>
            </section>

            <div className="order-secondary-actions no-print">
              <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                <Printer size={16} /> Print bill
              </button>
              {order.paymentStatus === 'PAID' && (
                <button type="button" className="btn btn-outline" onClick={openWhatsApp}>
                  <MessageCircle size={16} /> WhatsApp receipt
                </button>
              )}
              {order.canCancel && (
                <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setConfirmCancel(true)}>
                  Cancel this order
                </button>
              )}
            </div>

            {waOpened && (
              <div className="send-confirmation no-print">
                <p>
                  WhatsApp opened with your receipt. Press <strong>Send</strong> manually in WhatsApp;
                  this app never sends it for you.
                </p>
                {waConfirmed ? (
                  <span className="confirmed-send">
                    <CheckCircle2 size={15} /> Manual send confirmed.
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setWaConfirmed(true);
                      addToast('Manual WhatsApp send confirmed.', 'success');
                    }}
                  >
                    I pressed Send in WhatsApp
                  </button>
                )}
              </div>
            )}

            <div className="order-help">
              <Clock3 size={17} />
              <span>
                Status refreshes every 5 seconds. For allergies or urgent changes, please speak to
                restaurant staff — this page is not a live chat.
              </span>
            </div>
          </div>

          <aside className="order-side-column no-print">
            <PaymentPanel order={order} config={config} onRefresh={() => loadOrder(true)} />
            <div className="order-identity-card">
              <span className="eyebrow">Table identity</span>
              <h3>
                {order.table.tableNumber} · {order.table.label || 'Dining room'}
              </h3>
              <p>
                This order is linked to the table QR that opened the menu. Another table token cannot
                read or modify this bill.
              </p>
              <span className="veg-legend">
                <VegMark isVeg /> Vegetarian <VegMark isVeg={false} /> Non-vegetarian
              </span>
            </div>
          </aside>
        </div>
      </main>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={handleCancel}
        title="Cancel this order?"
        message="This can only be done while the order is still placed and unpaid. The kitchen will see it as cancelled immediately."
        confirmLabel="Cancel order"
        danger
        busy={cancelling}
      />
    </div>
  );
}
