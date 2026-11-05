import { parsePositiveId } from '../middleware/validate.js';
import { AppError } from '../utils/errors.js';
import { generateRequestKey } from '../utils/ids.js';
import {
  createMenuItem,
  createTableAdmin,
  getAdminSettings,
  getSalesSummary,
  getTableQrAdmin,
  listAdminOrders,
  listAdminPayments,
  listAuditLogs,
  listMenuAdmin,
  listTablesAdmin,
  rotateTableAdmin,
  updateAdminSettings,
  updateMenuItem,
  updateTableAdmin,
} from '../services/adminService.js';
import { getOrderBundle, applyOrderDiscount } from '../services/orderService.js';
import { getPaymentDetailsAdmin, reconcilePayment, refundPayment } from '../services/paymentService.js';

export function summary(_req, res) {
  res.json(getSalesSummary());
}

export function menu(_req, res) {
  res.json({ items: listMenuAdmin() });
}

export function addMenuItem(req, res) {
  res.status(201).json({ item: createMenuItem(req.validated.body, req.user, req.ip) });
}

export function editMenuItem(req, res) {
  const id = parsePositiveId(req.params.id, 'Menu item ID');
  res.json({ item: updateMenuItem(id, req.validated.body, req.user, req.ip) });
}

export function orders(req, res) {
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null;
  const paymentStatus =
    typeof req.query.paymentStatus === 'string' ? req.query.paymentStatus.toUpperCase() : null;
  res.json({ orders: listAdminOrders({ limit, status, paymentStatus }) });
}

export function orderDetail(req, res) {
  res.json({ order: getOrderBundle(req.params.publicId) });
}

export function discountOrder(req, res) {
  const order = applyOrderDiscount(
    req.params.publicId,
    req.validated.body.discountPaise,
    req.validated.body.reason,
    req.user,
    req.ip,
  );
  res.json({ order });
}

export function tables(_req, res) {
  res.json({ tables: listTablesAdmin() });
}

export function addTable(req, res) {
  res.status(201).json({ table: createTableAdmin(req.validated.body, req.user, req.ip) });
}

export function editTable(req, res) {
  const id = parsePositiveId(req.params.id, 'Table ID');
  res.json({ table: updateTableAdmin(id, req.validated.body, req.user, req.ip) });
}

export function rotateTable(req, res) {
  const id = parsePositiveId(req.params.id, 'Table ID');
  res.json({ table: rotateTableAdmin(id, req.user, req.ip) });
}

export async function tableQr(req, res) {
  const id = parsePositiveId(req.params.id, 'Table ID');
  res.json(await getTableQrAdmin(id));
}

export function payments(req, res) {
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  res.json({ payments: listAdminPayments({ limit }) });
}

export function settings(_req, res) {
  res.json({ settings: getAdminSettings() });
}

export function updateSettings(req, res) {
  res.json({ settings: updateAdminSettings(req.validated.body, req.user, req.ip) });
}

export function auditLogs(req, res) {
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
  res.json({ logs: listAuditLogs(limit) });
}

export async function refund(req, res) {
  const id = parsePositiveId(req.params.id, 'Payment ID');
  const rawKey = req.get('Idempotency-Key') || generateRequestKey();
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(rawKey)) {
    throw new AppError(
      400,
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key must be 8–120 letters, numbers, dots, colons, underscores or hyphens.',
    );
  }
  const result = await refundPayment(id, req.validated.body, rawKey, req.user, req.ip);
  res.status(result.duplicate ? 200 : 201).json(result);
}

export async function reconcile(req, res) {
  const id = parsePositiveId(req.params.id, 'Payment ID');
  const result = await reconcilePayment(id, req.user, req.ip);
  res.json(result);
}

export function paymentDetail(req, res) {
  const id = parsePositiveId(req.params.id, 'Payment ID');
  res.json({ payment: getPaymentDetailsAdmin(id) });
}
