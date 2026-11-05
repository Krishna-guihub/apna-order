import { getOrderBundle, listKitchenOrders, updateOrderStatus } from '../services/orderService.js';
import { kitchenWhatsAppForOrder } from '../services/whatsappService.js';
import { AppError } from '../utils/errors.js';

export function getOrders(req, res) {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ACTIVE';
  const limitRaw = Number(req.query.limit || 100);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 100;
  res.json(listKitchenOrders({ status, limit }));
}

export function getOrder(req, res) {
  res.json({ order: getOrderBundle(req.params.publicId) });
}

export function changeStatus(req, res) {
  const order = updateOrderStatus(
    req.params.publicId,
    req.validated.body.status,
    req.user,
    req.ip,
  );
  res.json({ order });
}

export function getKitchenWhatsApp(req, res) {
  res.json(kitchenWhatsAppForOrder(req.params.publicId));
}

export function health(req, res) {
  res.json({ ok: true, user: { id: req.user.id, role: req.user.role } });
}

export function parseOrderQuery(req, _res, next) {
  if (req.query.status && typeof req.query.status !== 'string') {
    return next(new AppError(400, 'INVALID_QUERY', 'Invalid status filter.'));
  }
  next();
}
