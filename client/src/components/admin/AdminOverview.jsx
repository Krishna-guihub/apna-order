import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeIndianRupee,
  CalendarDays,
  ChefHat,
  CreditCard,
  Flame,
  IndianRupee,
  ReceiptText,
  ShieldCheck,
  TestTube2,
  TrendingUp,
} from 'lucide-react';
import { AdminPanel, AdminSectionHeader } from './shared.jsx';
import {
  Badge,
  EmptyState,
  ErrorState,
  PaymentBadge,
  StatCard,
  StatusBadge,
} from '../ui.jsx';
import { api } from '../../api/client.js';
import { usePolling } from '../../hooks/usePolling.js';
import { formatDay, formatDateTime, formatMoney, formatMoneyCompact, parseApiError } from '../../utils/format.js';

export default function AdminOverview({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await api.get('/admin/summary');
      setSummary(data);
      setError('');
    } catch (loadError) {
      setError(parseApiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  usePolling(() => loadSummary(true), 15000);

  const maxDaily = Math.max(1, ...(summary?.dailySales || []).map((day) => day.grossPaise));

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Command centre"
        title="The dining room, at a glance."
        description="Live order load, verified settlement totals and the dishes guests are loving right now."
        busy={refreshing}
        onRefresh={() => loadSummary()}
        actions={
          <Link to="/kitchen" className="btn btn-primary btn-sm">
            <ChefHat size={16} /> Open kitchen board
          </Link>
        }
      />

      {summary?.paymentMode === 'simulated' && (
        <div className="admin-mode-banner">
          <span className="admin-mode-icon">
            <TestTube2 size={17} />
          </span>
          <div>
            <strong>Local payment simulation is active.</strong>
            <span>
              Simulated payments are labelled throughout and move no money. They are automatically
              disabled when <code>NODE_ENV=production</code>.
            </span>
          </div>
        </div>
      )}

      {error && (
        <ErrorState
          title="The dashboard could not refresh"
          message={error}
          onRetry={() => loadSummary()}
        />
      )}

      {loading ? (
        <div className="admin-stat-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="admin-stat-skeleton" key={index} />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="admin-stat-grid">
            <StatCard
              label="Gross revenue"
              value={formatMoney(summary.grossRevenuePaise)}
              hint="Verified payments at full value"
              icon={IndianRupee}
              tone="green"
            />
            <StatCard
              label="Collected today"
              value={formatMoney(summary.todayGrossPaise)}
              hint={`${summary.todayOrders} orders placed today`}
              icon={CalendarDays}
              tone="amber"
            />
            <StatCard
              label="Net after refunds"
              value={formatMoney(summary.netRevenuePaise)}
              hint={`${formatMoney(summary.refundedPaise)} refunded`}
              icon={BadgeIndianRupee}
              tone="orange"
            />
            <StatCard
              label="Active tickets"
              value={summary.activeOrders}
              hint="Placed, preparing or ready"
              icon={ChefHat}
              tone="blue"
            />
          </div>

          <div className="admin-secondary-stats">
            <div>
              <span>All orders</span>
              <strong>{summary.totalOrders}</strong>
            </div>
            <div>
              <span>Paid orders</span>
              <strong>{summary.paidOrderCount}</strong>
            </div>
            <div>
              <span>Pending payments</span>
              <strong>{summary.pendingPaymentCount}</strong>
            </div>
            <div>
              <span>Average bill</span>
              <strong>{formatMoney(summary.averageOrderPaise)}</strong>
            </div>
            <div>
              <span>Simulated revenue</span>
              <strong>{formatMoney(summary.simulatedRevenuePaise)}</strong>
            </div>
          </div>

          <div className="admin-overview-grid">
            <AdminPanel
              title="Verified sales"
              subtitle="Last seven days of paid settlements"
              className="admin-chart-panel"
              actions={
                <Badge tone="green" dot>
                  <TrendingUp size={13} /> Live totals
                </Badge>
              }
            >
              {summary.dailySales.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title="No verified sales yet"
                  message="Simulate a payment on a customer order or complete a Razorpay test payment to see the trend here."
                />
              ) : (
                <div className="admin-bar-chart" role="img" aria-label="Verified sales for the last seven days">
                  {summary.dailySales.map((day) => {
                    const height = Math.max(6, Math.round((day.grossPaise / maxDaily) * 100));
                    return (
                      <div className="admin-bar-column" key={day.day}>
                        <span className="admin-bar-value">{formatMoneyCompact(day.grossPaise)}</span>
                        <div className="admin-bar-track">
                          <div className="admin-bar-fill" style={{ height: `${height}%` }} />
                        </div>
                        <span className="admin-bar-label">{formatDay(day.day)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </AdminPanel>

            <AdminPanel
              title="Most ordered"
              subtitle="By quantity across paid orders"
              actions={
                <button type="button" className="text-button" onClick={() => onNavigate('menu')}>
                  Manage menu <ArrowUpRight size={14} />
                </button>
              }
            >
              {summary.topItems.length === 0 ? (
                <EmptyState
                  icon={Flame}
                  title="No favourites yet"
                  message="Top dishes appear once orders have been settled."
                />
              ) : (
                <ol className="admin-top-items">
                  {summary.topItems.map((item, index) => (
                    <li key={item.name}>
                      <span className="admin-top-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div className="admin-top-copy">
                        <strong>{item.name}</strong>
                        <small>{item.quantity} plates · {formatMoney(item.revenuePaise)}</small>
                      </div>
                      <span className="admin-top-bar" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.max(
                              10,
                              Math.round((item.quantity / summary.topItems[0].quantity) * 100),
                            )}%`,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </AdminPanel>
          </div>

          <AdminPanel
            title="Latest table orders"
            subtitle="The six most recent orders across every table"
            actions={
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('orders')}>
                All orders <ArrowUpRight size={15} />
              </button>
            }
            bodyClassName="admin-panel-body-flush"
          >
            {summary.recentOrders.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No orders yet"
                message="Open a table menu and place a demo order to see the flow."
                action={
                  <Link to="/" className="btn btn-outline">
                    Open demo tables
                  </Link>
                }
              />
            ) : (
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Table</th>
                      <th>Guest</th>
                      <th>Total</th>
                      <th>Kitchen</th>
                      <th>Settlement</th>
                      <th>Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentOrders.map((order) => (
                      <tr key={order.publicId}>
                        <td className="mono">{order.publicId}</td>
                        <td>
                          <span className="admin-table-strong">Table {order.table.tableNumber}</span>
                          <small>{order.table.label || 'Dining room'}</small>
                        </td>
                        <td>{order.customerName}</td>
                        <td className="admin-money">{formatMoney(order.totalPaise)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td>
                          <PaymentBadge status={order.paymentStatus} />
                        </td>
                        <td className="admin-muted">{formatDateTime(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanel>

          <div className="admin-assurance-row">
            <span>
              <ShieldCheck size={16} /> Every total is recalculated on the server.
            </span>
            <span>
              <CreditCard size={16} /> Payments are confirmed by signature, webhook or reconciliation.
            </span>
            <span>
              <ReceiptText size={16} /> Discounts and refunds are written to the audit log.
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
