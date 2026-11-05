import { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  ChefHat,
  Clock3,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Timer,
  Utensils,
} from 'lucide-react';
import StaffShell from '../components/StaffShell.jsx';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ManualSendNotice,
  PaymentBadge,
  Spinner,
  StatCard,
  StatusBadge,
  VegMark,
} from '../components/ui.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { usePolling } from '../hooks/usePolling.js';
import {
  classNames,
  elapsedLabel,
  formatMoney,
  parseApiError,
} from '../utils/format.js';

const FILTERS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PLACED', label: 'Placed' },
  { value: 'PREPARING', label: 'Preparing' },
  { value: 'READY', label: 'Ready' },
  { value: 'SERVED', label: 'Served' },
  { value: 'ALL', label: 'All' },
];

const NEXT_ACTION = {
  PLACED: { status: 'PREPARING', label: 'Start preparing', icon: ChefHat },
  PREPARING: { status: 'READY', label: 'Mark ready', icon: BellRing },
  READY: { status: 'SERVED', label: 'Mark served', icon: Utensils },
};

export default function KitchenPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [filter, setFilter] = useState('ACTIVE');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({
    placed: 0,
    preparing: 0,
    ready: 0,
    served: 0,
    cancelled: 0,
    active: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [waFresh, setWaFresh] = useState(null);
  const [waConfirmed, setWaConfirmed] = useState(false);

  const loadOrders = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const data = await api.get(`/staff/orders?status=${filter}&limit=150`);
        setOrders(data.orders);
        setCounts(data.counts);
        setError('');
      } catch (loadError) {
        setError(parseApiError(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    setLoading(true);
    loadOrders();
  }, [loadOrders]);

  usePolling(() => loadOrders(true), 4000);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updateStatus = async (order, nextStatus) => {
    setUpdatingId(order.publicId);
    try {
      await api.patch(`/staff/orders/${order.publicId}/status`, { status: nextStatus });
      addToast(`Order ${order.publicId} moved to ${nextStatus.toLowerCase()}.`, 'success');
      await loadOrders(true);
    } catch (updateError) {
      addToast(parseApiError(updateError), 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const cancelOrder = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.patch(`/staff/orders/${cancelTarget.publicId}/status`, { status: 'CANCELLED' });
      addToast(`Order ${cancelTarget.publicId} cancelled.`, 'info');
      setCancelTarget(null);
      await loadOrders(true);
    } catch (cancelError) {
      addToast(parseApiError(cancelError), 'error');
    } finally {
      setCancelling(false);
    }
  };

  const openKitchenWhatsApp = async (order) => {
    try {
      const result = await api.get(`/staff/orders/${order.publicId}/whatsapp-kitchen`);
      window.open(result.url, '_blank', 'noopener,noreferrer');
      setWaFresh(order.publicId);
      setWaConfirmed(false);
      addToast('WhatsApp opened. Review the order and press Send manually.', 'info');
    } catch (whatsappError) {
      addToast(parseApiError(whatsappError), 'error');
    }
  };

  return (
    <StaffShell active="kitchen">
      <div className="shell staff-page">
        <div className="staff-page-head">
          <div>
            <span className="eyebrow">
              <span className="live-dot" /> Live kitchen board
            </span>
            <h1>Good service starts here.</h1>
            <p className="staff-lead">
              Incoming table orders, preparation timers and one-tap status updates. Auto-refreshes every
              4 seconds.
            </p>
          </div>
          <div className="staff-head-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => loadOrders()}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refresh board
            </button>
          </div>
        </div>

        <div className="kitchen-stats">
          <StatCard label="Placed" value={counts.placed} hint="Waiting to start" icon={BellRing} tone="amber" />
          <StatCard label="Preparing" value={counts.preparing} hint="On the pass" icon={ChefHat} tone="orange" />
          <StatCard label="Ready" value={counts.ready} hint="For the floor" icon={Timer} tone="blue" />
          <StatCard label="Active tickets" value={counts.active} hint="Placed + preparing + ready" icon={Clock3} tone="green" />
        </div>

        <div className="kitchen-toolbar">
          <div className="kitchen-filters" role="tablist" aria-label="Filter kitchen orders">
            {FILTERS.map((option) => (
              <button
                type="button"
                key={option.value}
                role="tab"
                aria-selected={filter === option.value}
                className={classNames('filter-chip', filter === option.value && 'active')}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
                {option.value === 'ACTIVE' && counts.active > 0 && (
                  <span className="filter-count">{counts.active}</span>
                )}
              </button>
            ))}
          </div>
          <span className="refresh-note">
            <span className="pulse-dot" /> Auto-updating
          </span>
        </div>

        {waFresh && (
          <div className="whatsapp-confirm-bar">
            <MessageCircle size={18} />
            <div>
              <strong>WhatsApp opened for {waFresh}.</strong>
              <span>Press Send inside WhatsApp — this system does not send automatically.</span>
            </div>
            {waConfirmed ? (
              <Badge tone="green">Manual send confirmed</Badge>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setWaConfirmed(true);
                  addToast('Manual WhatsApp send confirmed.', 'success');
                }}
              >
                I pressed Send
              </button>
            )}
          </div>
        )}

        {error && (
          <ErrorState
            title="The kitchen board lost its connection"
            message={error}
            onRetry={() => loadOrders()}
          />
        )}

        {loading ? (
          <div className="kitchen-loading">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="kitchen-skeleton" key={index} />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title={filter === 'ACTIVE' ? 'The pass is clear' : 'No orders in this filter'}
            message={
              filter === 'ACTIVE'
                ? 'New table orders will appear here automatically. A calm kitchen is a good kitchen.'
                : 'Try another status filter or wait for the next table order.'
            }
          />
        ) : (
          <div className="kitchen-grid">
            {orders.map((order) => {
              const action = NEXT_ACTION[order.status];
              const ActionIcon = action?.icon;
              const ageMinutes = (now - new Date(order.createdAt).getTime()) / 60000;
              const isHot = ['PLACED', 'PREPARING'].includes(order.status) && ageMinutes > 20;
              return (
                <article
                  className={classNames(
                    'kitchen-ticket',
                    isHot && 'ticket-hot',
                    order.status === 'CANCELLED' && 'ticket-muted',
                  )}
                  key={order.publicId}
                >
                  <div className="ticket-head">
                    <div className="ticket-table">
                      <span>Table</span>
                      <strong>{String(order.table.tableNumber).padStart(2, '0')}</strong>
                    </div>
                    <div className="ticket-head-copy">
                      <div className="ticket-id-row">
                        <strong>{order.publicId}</strong>
                        <StatusBadge status={order.status} />
                      </div>
                      <span className="ticket-timer">
                        <Clock3 size={14} />
                        {elapsedLabel(order.createdAt, now)} ago
                        {isHot && <span className="ticket-late">running late</span>}
                      </span>
                    </div>
                  </div>

                  <div className="ticket-meta-row">
                    <PaymentBadge status={order.paymentStatus} />
                    <span className="ticket-guest">{order.customerName}</span>
                    <span className="ticket-total">{formatMoney(order.totalPaise)}</span>
                  </div>

                  <div className="ticket-items">
                    {order.items.map((item) => (
                      <div className="ticket-item" key={item.id}>
                        <VegMark isVeg={item.isVeg} />
                        <span className="ticket-qty">{item.quantity}×</span>
                        <span className="ticket-item-name">{item.name}</span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="ticket-note">
                      <span>Note</span>
                      <p>{order.notes}</p>
                    </div>
                  )}

                  <div className="ticket-actions">
                    {action && (
                      <button
                        type="button"
                        className="btn btn-primary ticket-primary"
                        onClick={() => updateStatus(order, action.status)}
                        disabled={updatingId === order.publicId}
                      >
                        {updatingId === order.publicId ? <Spinner size={16} /> : <ActionIcon size={16} />}
                        {action.label}
                      </button>
                    )}
                    {order.status === 'SERVED' && (
                      <span className="ticket-complete">Service complete</span>
                    )}
                    {order.status === 'CANCELLED' && (
                      <span className="ticket-complete">Cancelled</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openKitchenWhatsApp(order)}
                      title="Opens WhatsApp; press Send manually"
                    >
                      <MessageCircle size={15} /> WhatsApp
                    </button>
                    {user?.role === 'admin' &&
                      !['SERVED', 'CANCELLED'].includes(order.status) && (
                        <button
                          type="button"
                          className="icon-button danger-icon"
                          onClick={() => setCancelTarget(order)}
                          aria-label={`Cancel order ${order.publicId}`}
                          title="Cancel order"
                        >
                          <ShieldAlert size={17} />
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <ManualSendNotice>
          Kitchen WhatsApp buttons open wa.me with a prefilled order summary. A staff member must
          review the message and press Send in WhatsApp. No message is sent automatically.
        </ManualSendNotice>
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={cancelOrder}
        title="Cancel this order?"
        message={
          cancelTarget?.paymentStatus === 'PAID'
            ? 'This order is paid. The server will block cancellation until a refund is recorded. Use the admin payment console to refund first.'
            : 'This immediately closes the order for the kitchen. The action is audited.'
        }
        confirmLabel="Cancel order"
        danger
        busy={cancelling}
      />
    </StaffShell>
  );
}
