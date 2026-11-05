import { config } from '../config.js';
import { db, getSetting, nowIso, transaction } from '../db.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { logAudit } from './auditService.js';
import { mapOrder, mapPayment } from './orderService.js';
import { mapRefund } from './paymentService.js';
import { listTables, createTable, rotateTableToken, tableQrDataUrl } from './tableService.js';

function mapMenuItem(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    pricePaise: row.price_paise,
    category: row.category,
    isVeg: Boolean(row.is_veg),
    imageUrl: row.image_url,
    isAvailable: Boolean(row.is_available),
    isArchived: Boolean(row.is_archived),
    prepMinutes: row.prep_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMenuAdmin() {
  return db
    .prepare('SELECT * FROM menu_items ORDER BY is_archived, category, name')
    .all()
    .map(mapMenuItem);
}

export function createMenuItem(data, user, ipAddress) {
  const timestamp = nowIso();
  const result = db.prepare(`
    INSERT INTO menu_items
      (name, description, price_paise, category, is_veg, image_url, is_available,
       is_archived, prep_minutes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    data.name,
    data.description || '',
    data.pricePaise,
    data.category,
    data.isVeg ? 1 : 0,
    data.imageUrl || '',
    data.isAvailable ? 1 : 0,
    data.prepMinutes,
    timestamp,
    timestamp,
  );
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(result.lastInsertRowid));
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'MENU_ITEM_CREATED',
    entityType: 'menu_item',
    entityId: item.id,
    metadata: { name: item.name, pricePaise: item.price_paise },
    ipAddress,
  });
  return mapMenuItem(item);
}

export function updateMenuItem(id, data, user, ipAddress) {
  const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  if (!existing) throw notFound('Menu item not found.');

  const next = {
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    price_paise: data.pricePaise ?? existing.price_paise,
    category: data.category ?? existing.category,
    is_veg: data.isVeg === undefined ? existing.is_veg : data.isVeg ? 1 : 0,
    image_url: data.imageUrl ?? existing.image_url,
    is_available:
      data.isAvailable === undefined ? existing.is_available : data.isAvailable ? 1 : 0,
    is_archived: data.isArchived === undefined ? existing.is_archived : data.isArchived ? 1 : 0,
    prep_minutes: data.prepMinutes ?? existing.prep_minutes,
  };

  if (next.is_archived && next.is_available) {
    next.is_available = 0;
  }

  db.prepare(`
    UPDATE menu_items
    SET name = ?, description = ?, price_paise = ?, category = ?, is_veg = ?,
        image_url = ?, is_available = ?, is_archived = ?, prep_minutes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.name,
    next.description,
    next.price_paise,
    next.category,
    next.is_veg,
    next.image_url,
    next.is_available,
    next.is_archived,
    next.prep_minutes,
    nowIso(),
    id,
  );

  const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'MENU_ITEM_UPDATED',
    entityType: 'menu_item',
    entityId: id,
    metadata: {
      name: updated.name,
      pricePaise: updated.price_paise,
      isAvailable: Boolean(updated.is_available),
      isArchived: Boolean(updated.is_archived),
    },
    ipAddress,
  });
  return mapMenuItem(updated);
}

export function getAdminSettings() {
  return {
    restaurantName: getSetting('restaurant_name', config.appName),
    taxRatePercent: Number(getSetting('tax_rate_bps', config.defaultTaxRateBps)) / 100,
    whatsappRestaurant: getSetting('whatsapp_restaurant_number', config.whatsapp.restaurantNumber),
    whatsappKitchen: getSetting('whatsapp_kitchen_number', config.whatsapp.kitchenNumber),
  };
}

export function updateAdminSettings(data, user, ipAddress) {
  const taxRateBps = Math.round(data.taxRatePercent * 100);
  const timestamp = nowIso();
  transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    upsert.run('restaurant_name', data.restaurantName, timestamp);
    upsert.run('tax_rate_bps', String(taxRateBps), timestamp);
    upsert.run('whatsapp_restaurant_number', data.whatsappRestaurant, timestamp);
    upsert.run('whatsapp_kitchen_number', data.whatsappKitchen, timestamp);
  });
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'SETTINGS_UPDATED',
    entityType: 'app_settings',
    entityId: 'global',
    metadata: { taxRateBps, restaurantName: data.restaurantName },
    ipAddress,
  });
  return getAdminSettings();
}

function mapAdminTable(table) {
  return {
    id: table.id,
    tableNumber: table.table_number,
    label: table.label || '',
    qrToken: table.qr_token,
    isActive: Boolean(table.is_active),
    menuUrl: `${config.frontendPublicUrl}/t/${table.qr_token}`,
    createdAt: table.created_at,
    updatedAt: table.updated_at,
  };
}

export function createTableAdmin(data, user, ipAddress) {
  const table = createTable(data);
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'TABLE_CREATED',
    entityType: 'restaurant_table',
    entityId: table.id,
    metadata: { tableNumber: table.table_number },
    ipAddress,
  });
  return mapAdminTable(table);
}

export function updateTableAdmin(id, data, user, ipAddress) {
  const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id);
  if (!table) throw notFound('Table not found.');
  db.prepare('UPDATE restaurant_tables SET is_active = ?, label = ?, updated_at = ? WHERE id = ?').run(
    data.isActive ? 1 : 0,
    data.label ?? table.label,
    nowIso(),
    id,
  );
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'TABLE_UPDATED',
    entityType: 'restaurant_table',
    entityId: id,
    metadata: { tableNumber: table.table_number, isActive: data.isActive },
    ipAddress,
  });
  const updated = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id);
  return mapAdminTable(updated);
}

export function rotateTableAdmin(id, user, ipAddress) {
  const table = rotateTableToken(id);
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'TABLE_TOKEN_ROTATED',
    entityType: 'restaurant_table',
    entityId: id,
    metadata: { tableNumber: table.table_number },
    ipAddress,
  });
  return mapAdminTable(table);
}

export async function getTableQrAdmin(id) {
  const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id);
  if (!table) throw notFound('Table not found.');
  return {
    tableNumber: table.table_number,
    label: table.label,
    isActive: Boolean(table.is_active),
    menuUrl: `${config.frontendPublicUrl}/t/${table.qr_token}`,
    dataUrl: await tableQrDataUrl(table),
  };
}

export function listTablesAdmin() {
  return listTables().map(mapAdminTable);
}

export function listAdminOrders({ limit = 100, status = null, paymentStatus = null } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (paymentStatus) {
    conditions.push('o.payment_status = ?');
    params.push(paymentStatus);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT o.*, t.table_number, t.label AS table_label
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ?
    `)
    .all(...params, limit);
  return rows.map((row) => mapOrder(row));
}

export function getSalesSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const orderCounts = db
    .prepare(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status IN ('PLACED', 'PREPARING', 'READY') THEN 1 ELSE 0 END) AS active_orders,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today_orders
      FROM orders
    `)
    .get(todayIso);

  const paymentTotals = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') THEN amount_paise ELSE 0 END), 0) AS gross_paise,
        COALESCE(SUM(CASE WHEN paid_at >= ? AND status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') THEN amount_paise ELSE 0 END), 0) AS today_gross_paise,
        COALESCE(SUM(CASE WHEN status IN ('CREATED', 'PENDING') THEN 1 ELSE 0 END), 0) AS pending_payment_count,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND provider = 'simulated' THEN amount_paise ELSE 0 END), 0) AS simulated_paise
      FROM payments
    `)
    .get(todayIso);

  const refundTotals = db
    .prepare(`
      SELECT COALESCE(SUM(CASE WHEN status = 'PROCESSED' THEN amount_paise ELSE 0 END), 0) AS refunded_paise
      FROM refunds
    `)
    .get();

  const paidOrderCount = db
    .prepare("SELECT COUNT(*) AS count FROM orders WHERE payment_status IN ('PAID', 'PARTIALLY_REFUNDED')")
    .get().count;

  const dailySales = db
    .prepare(`
      SELECT substr(paid_at, 1, 10) AS day,
             COALESCE(SUM(amount_paise), 0) AS gross_paise
      FROM payments
      WHERE paid_at IS NOT NULL
        AND status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
      GROUP BY substr(paid_at, 1, 10)
      ORDER BY day DESC
      LIMIT 7
    `)
    .all();

  const topItems = db
    .prepare(`
      SELECT oi.item_name AS name,
             SUM(oi.quantity) AS quantity,
             SUM(oi.line_total_paise) AS revenue_paise
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status IN ('PAID', 'PARTIALLY_REFUNDED')
      GROUP BY oi.item_name
      ORDER BY quantity DESC
      LIMIT 5
    `)
    .all();

  const recentOrders = db
    .prepare(`
      SELECT o.*, t.table_number, t.label AS table_label
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      ORDER BY o.created_at DESC
      LIMIT 6
    `)
    .all()
    .map((row) => mapOrder(row));

  const grossPaise = Number(paymentTotals.gross_paise);
  const refundedPaise = Number(refundTotals.refunded_paise);
  return {
    totalOrders: Number(orderCounts.total_orders),
    activeOrders: Number(orderCounts.active_orders || 0),
    todayOrders: Number(orderCounts.today_orders || 0),
    paidOrderCount: Number(paidOrderCount),
    pendingPaymentCount: Number(paymentTotals.pending_payment_count),
    grossRevenuePaise: grossPaise,
    todayGrossPaise: Number(paymentTotals.today_gross_paise),
    refundedPaise,
    netRevenuePaise: grossPaise - refundedPaise,
    simulatedRevenuePaise: Number(paymentTotals.simulated_paise),
    averageOrderPaise: paidOrderCount ? Math.round(grossPaise / paidOrderCount) : 0,
    dailySales: dailySales.reverse().map((row) => ({
      day: row.day,
      grossPaise: Number(row.gross_paise),
    })),
    topItems: topItems.map((row) => ({
      name: row.name,
      quantity: Number(row.quantity),
      revenuePaise: Number(row.revenue_paise),
    })),
    recentOrders,
    paymentMode: config.paymentMode,
  };
}

export function listAdminPayments({ limit = 100 } = {}) {
  const rows = db
    .prepare(`
      SELECT p.*, o.public_id, o.total_paise AS order_total_paise, o.payment_status,
             o.status AS order_status, o.customer_name, o.created_at AS order_created_at,
             t.table_number
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      JOIN restaurant_tables t ON t.id = o.table_id
      ORDER BY p.created_at DESC
      LIMIT ?
    `)
    .all(limit);

  return rows.map((row) => ({
    ...mapPayment(row),
    orderPublicId: row.public_id,
    orderTotalPaise: row.order_total_paise,
    orderPaymentStatus: row.payment_status,
    orderStatus: row.order_status,
    customerName: row.customer_name,
    tableNumber: row.table_number,
    orderCreatedAt: row.order_created_at,
    refunds: db
      .prepare(`
        SELECT r.*, o.public_id
        FROM refunds r
        JOIN payments p ON p.id = r.payment_id
        JOIN orders o ON o.id = p.order_id
        WHERE r.payment_id = ?
        ORDER BY r.created_at DESC
      `)
      .all(row.id)
      .map(mapRefund),
  }));
}

export function listAuditLogs(limit = 100) {
  return db
    .prepare(`
      SELECT a.*, u.name AS user_name, u.email AS user_email
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT ?
    `)
    .all(limit)
    .map((row) => ({
      id: row.id,
      actorRole: row.actor_role,
      user: row.user_name || null,
      email: row.user_email || null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: safeParseJson(row.metadata_json),
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    }));
}

function safeParseJson(value) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

export function validateMenuPrice(pricePaise) {
  if (!Number.isInteger(pricePaise) || pricePaise < 100) {
    throw badRequest('Price must be at least ₹1.00.');
  }
}
