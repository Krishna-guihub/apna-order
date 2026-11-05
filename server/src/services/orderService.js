import { db, getNumericSetting, nowIso, transaction } from '../db.js';
import { assertValidStatusTransition, ORDER_STATUSES } from './orderState.js';
import { generateOrderPublicId } from '../utils/ids.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { requireTableByToken } from './tableService.js';
import { logAudit } from './auditService.js';

export function calculateTotals(items, taxRateBps, discountPaise = 0) {
  const subtotalPaise = items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const safeDiscount = Math.min(Math.max(0, discountPaise), subtotalPaise);
  const taxablePaise = subtotalPaise - safeDiscount;
  const taxPaise = Math.round((taxablePaise * taxRateBps) / 10000);
  return {
    subtotalPaise,
    discountPaise: safeDiscount,
    taxPaise,
    totalPaise: taxablePaise + taxPaise,
  };
}

function getPaymentRow(orderId) {
  return db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId) || null;
}

function getRefundSummary(paymentId) {
  return db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PROCESSED' THEN amount_paise ELSE 0 END), 0) AS refunded_paise,
        COUNT(*) AS refund_count
      FROM refunds
      WHERE payment_id = ?
    `)
    .get(paymentId);
}

export function mapPayment(row) {
  if (!row) return null;
  const refunds = getRefundSummary(row.id);
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    isSimulated: Boolean(row.is_simulated),
    signatureVerified: Boolean(row.signature_verified),
    verifiedVia: row.verified_via || null,
    amountPaise: row.amount_paise,
    currency: row.currency,
    method: row.method || null,
    paidAt: row.paid_at,
    providerPaymentId: row.provider_payment_id,
    failureReason: row.failure_reason,
    refundedPaise: Number(refunds.refunded_paise),
    refundCount: Number(refunds.refund_count),
  };
}

export function mapOrder(row, { includePayment = true } = {}) {
  if (!row) return null;
  const items = db
    .prepare(`
      SELECT oi.id, oi.menu_item_id, oi.item_name, oi.unit_price_paise, oi.quantity,
             oi.line_total_paise, mi.is_veg
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `)
    .all(row.id)
    .map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.item_name,
      unitPricePaise: item.unit_price_paise,
      quantity: item.quantity,
      lineTotalPaise: item.line_total_paise,
      isVeg: item.is_veg === null || item.is_veg === undefined ? true : Boolean(item.is_veg),
    }));

  const payment = includePayment ? mapPayment(getPaymentRow(row.id)) : null;

  return {
    id: row.id,
    publicId: row.public_id,
    table: {
      id: row.table_id,
      tableNumber: row.table_number,
      label: row.table_label || '',
    },
    customerName: row.customer_name,
    customerPhone: row.customer_phone || null,
    status: row.status,
    paymentStatus: row.payment_status,
    notes: row.notes,
    items,
    subtotalPaise: row.subtotal_paise,
    taxRateBps: row.tax_rate_bps,
    taxRatePercent: row.tax_rate_bps / 100,
    taxPaise: row.tax_paise,
    discountPaise: row.discount_paise,
    discountReason: row.discount_reason,
    totalPaise: row.total_paise,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    servedAt: row.served_at,
    cancelledAt: row.cancelled_at,
    payment,
  };
}

function getOrderRow(publicId) {
  return db
    .prepare(`
      SELECT o.*, t.table_number, t.label AS table_label
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.public_id = ?
    `)
    .get(publicId);
}

export function getOrderBundle(publicId, { tableId = null } = {}) {
  const row = getOrderRow(publicId);
  if (!row) throw notFound('Order not found.');
  if (tableId !== null && row.table_id !== tableId) {
    throw notFound('Order not found for this table.');
  }
  return mapOrder(row);
}

export function getMenuForTable(tableToken) {
  requireTableByToken(tableToken);
  const items = db
    .prepare(`
      SELECT id, name, description, price_paise, category, is_veg, image_url,
             is_available, prep_minutes
      FROM menu_items
      WHERE is_archived = 0
      ORDER BY category, name
    `)
    .all()
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      pricePaise: item.price_paise,
      category: item.category,
      isVeg: Boolean(item.is_veg),
      imageUrl: item.image_url,
      isAvailable: Boolean(item.is_available),
      prepMinutes: item.prep_minutes,
    }));

  return {
    categories: [...new Set(items.map((item) => item.category))],
    items,
  };
}

export function createOrder({ tableToken, customerName, customerPhone, notes, items }, ipAddress) {
  const table = requireTableByToken(tableToken);

  const mergedItems = new Map();
  for (const line of items) {
    mergedItems.set(line.menuItemId, (mergedItems.get(line.menuItemId) || 0) + line.quantity);
  }

  const menuRows = [];
  for (const [menuItemId, quantity] of mergedItems.entries()) {
    if (quantity > 20) {
      throw badRequest('A single item cannot have more than 20 quantities.');
    }
    const item = db
      .prepare(`
        SELECT id, name, price_paise, is_available, is_archived
        FROM menu_items
        WHERE id = ?
      `)
      .get(menuItemId);
    if (!item) throw badRequest(`Menu item ${menuItemId} does not exist.`);
    if (item.is_archived || !item.is_available) {
      throw conflict(`${item.name} is currently unavailable. Please refresh the menu.`);
    }
    menuRows.push({
      ...item,
      quantity,
      lineTotalPaise: item.price_paise * quantity,
    });
  }

  if (menuRows.length === 0) throw badRequest('Your cart is empty.');

  const taxRateBps = Math.round(getNumericSetting('tax_rate_bps', 500));
  const totals = calculateTotals(menuRows, taxRateBps, 0);
  if (totals.totalPaise <= 0) throw badRequest('Order total must be greater than zero.');

  let publicId = generateOrderPublicId();
  while (db.prepare('SELECT 1 FROM orders WHERE public_id = ?').get(publicId)) {
    publicId = generateOrderPublicId();
  }

  const timestamp = nowIso();
  const orderId = transaction(() => {
    const orderResult = db
      .prepare(`
        INSERT INTO orders
          (public_id, table_id, customer_name, customer_phone, status, payment_status, notes,
           subtotal_paise, tax_rate_bps, tax_paise, discount_paise, total_paise,
           discount_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'PLACED', 'UNPAID', ?, ?, ?, ?, 0, ?, '', ?, ?)
      `)
      .run(
        publicId,
        table.id,
        customerName,
        customerPhone || null,
        notes || '',
        totals.subtotalPaise,
        taxRateBps,
        totals.taxPaise,
        totals.totalPaise,
        timestamp,
        timestamp,
      );

    const id = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO order_items
        (order_id, menu_item_id, item_name, unit_price_paise, quantity, line_total_paise, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of menuRows) {
      insertItem.run(
        id,
        item.id,
        item.name,
        item.price_paise,
        item.quantity,
        item.lineTotalPaise,
        timestamp,
      );
    }
    return id;
  });

  logAudit({
    actorRole: 'customer',
    action: 'ORDER_PLACED',
    entityType: 'order',
    entityId: publicId,
    metadata: {
      orderId,
      tableNumber: table.table_number,
      itemCount: menuRows.length,
      totalPaise: totals.totalPaise,
    },
    ipAddress,
  });

  return getOrderBundle(publicId, { tableId: table.id });
}

export function getCustomerOrder(publicId, tableToken) {
  const table = requireTableByToken(tableToken);
  const order = getOrderBundle(publicId, { tableId: table.id });
  const canCancel =
    order.status === 'PLACED' && ['UNPAID', 'PAYMENT_PENDING'].includes(order.paymentStatus);
  const hasVerifiedPayment =
    order.paymentStatus === 'PAID' && order.payment && Boolean(order.payment.verifiedVia);
  return {
    ...order,
    canCancel,
    canPay: ['UNPAID', 'PAYMENT_PENDING'].includes(order.paymentStatus) && order.status !== 'CANCELLED',
    hasVerifiedPayment: Boolean(hasVerifiedPayment),
  };
}

export function cancelCustomerOrder(publicId, tableToken, ipAddress) {
  const table = requireTableByToken(tableToken);
  const row = getOrderRow(publicId);
  if (!row || row.table_id !== table.id) throw notFound('Order not found for this table.');
  if (row.status !== 'PLACED') {
    throw conflict('This order is already being prepared. Please speak to restaurant staff.');
  }
  if (!['UNPAID', 'PAYMENT_PENDING'].includes(row.payment_status)) {
    throw conflict('A paid order cannot be cancelled by the customer. Please contact staff.');
  }

  const timestamp = nowIso();
  transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'CANCELLED', cancelled_at = ?, updated_at = ?
      WHERE id = ? AND status = 'PLACED'
    `).run(timestamp, timestamp, row.id);
    const activePayment = db
      .prepare("SELECT id FROM payments WHERE order_id = ? AND status IN ('CREATED', 'PENDING')")
      .get(row.id);
    if (activePayment) {
      db.prepare("UPDATE payments SET status = 'FAILED', failure_reason = ?, updated_at = ? WHERE id = ?").run(
        'Order cancelled by customer',
        timestamp,
        activePayment.id,
      );
    }
  });

  logAudit({
    actorRole: 'customer',
    action: 'ORDER_CANCELLED_BY_CUSTOMER',
    entityType: 'order',
    entityId: publicId,
    metadata: { tableNumber: table.table_number },
    ipAddress,
  });

  return getCustomerOrder(publicId, tableToken);
}

export function listKitchenOrders({ status = 'ACTIVE', limit = 100 }) {
  let where;
  let params = [];
  if (status === 'ACTIVE') {
    where = "o.status IN ('PLACED', 'PREPARING', 'READY')";
  } else if (status === 'ALL') {
    where = '1 = 1';
  } else if (ORDER_STATUSES.includes(status)) {
    where = 'o.status = ?';
    params = [status];
  } else {
    throw badRequest('Invalid status filter.');
  }

  const orderDirection = status === 'ACTIVE' ? 'ASC' : 'DESC';
  const rows = db
    .prepare(`
      SELECT o.*, t.table_number, t.label AS table_label
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE ${where}
      ORDER BY o.created_at ${orderDirection}
      LIMIT ?
    `)
    .all(...params, limit);

  const counts = Object.fromEntries(
    db
      .prepare('SELECT status, COUNT(*) AS count FROM orders GROUP BY status')
      .all()
      .map((row) => [row.status, Number(row.count)]),
  );

  return {
    orders: rows.map((row) => mapOrder(row)),
    counts: {
      placed: counts.PLACED || 0,
      preparing: counts.PREPARING || 0,
      ready: counts.READY || 0,
      served: counts.SERVED || 0,
      cancelled: counts.CANCELLED || 0,
      active: (counts.PLACED || 0) + (counts.PREPARING || 0) + (counts.READY || 0),
    },
    serverTime: nowIso(),
  };
}

export function updateOrderStatus(publicId, nextStatus, user, ipAddress) {
  const row = getOrderRow(publicId);
  if (!row) throw notFound('Order not found.');
  assertValidStatusTransition(row.status, nextStatus);

  if (nextStatus === 'CANCELLED') {
    if (user.role !== 'admin') {
      throw forbidden('Only an administrator can cancel an order.');
    }
    if (['PAID', 'PARTIALLY_REFUNDED'].includes(row.payment_status)) {
      throw conflict('Refund the payment before cancelling this paid order.');
    }
  }

  const timestamp = nowIso();
  const servedAt = nextStatus === 'SERVED' ? timestamp : row.served_at;
  const cancelledAt = nextStatus === 'CANCELLED' ? timestamp : row.cancelled_at;
  db.prepare(`
    UPDATE orders
    SET status = ?, served_at = ?, cancelled_at = ?, updated_at = ?
    WHERE id = ?
  `).run(nextStatus, servedAt, cancelledAt, timestamp, row.id);

  if (nextStatus === 'CANCELLED') {
    db.prepare(`
      UPDATE payments
      SET status = 'FAILED', failure_reason = 'Order cancelled by restaurant', updated_at = ?
      WHERE order_id = ? AND status IN ('CREATED', 'PENDING')
    `).run(timestamp, row.id);
  }

  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'ORDER_STATUS_CHANGED',
    entityType: 'order',
    entityId: publicId,
    metadata: { from: row.status, to: nextStatus, tableNumber: row.table_number },
    ipAddress,
  });

  return getOrderBundle(publicId);
}

export function applyOrderDiscount(publicId, discountPaise, reason, user, ipAddress) {
  const row = getOrderRow(publicId);
  if (!row) throw notFound('Order not found.');
  if (row.payment_status !== 'UNPAID') {
    throw conflict('A discount can only be applied before a payment is initialized.');
  }
  const existingPayment = db.prepare('SELECT id FROM payments WHERE order_id = ?').get(row.id);
  if (existingPayment) {
    throw conflict('A payment attempt already exists for this order. Create a new order to apply a discount.');
  }
  if (discountPaise > row.subtotal_paise) {
    throw badRequest('Discount cannot exceed the subtotal.');
  }

  const items = db
    .prepare('SELECT unit_price_paise, quantity FROM order_items WHERE order_id = ?')
    .all(row.id)
    .map((item) => ({
      lineTotalPaise: item.unit_price_paise * item.quantity,
    }));
  const totals = calculateTotals(items, row.tax_rate_bps, discountPaise);
  const timestamp = nowIso();

  db.prepare(`
    UPDATE orders
    SET discount_paise = ?, tax_paise = ?, total_paise = ?, discount_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(totals.discountPaise, totals.taxPaise, totals.totalPaise, reason, timestamp, row.id);

  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'ORDER_DISCOUNT_APPLIED',
    entityType: 'order',
    entityId: publicId,
    metadata: {
      discountPaise: totals.discountPaise,
      reason,
      newTotalPaise: totals.totalPaise,
    },
    ipAddress,
  });

  return getOrderBundle(publicId);
}

export function getTaxRateBps() {
  return Math.round(getNumericSetting('tax_rate_bps', 500));
}
