import { config } from '../config.js';
import { getSetting } from '../db.js';
import { tableTokenSchema } from '../validation/schemas.js';
import { AppError } from '../utils/errors.js';
import {
  getMenuForTable,
  getCustomerOrder,
  createOrder,
  cancelCustomerOrder,
} from '../services/orderService.js';
import { getPublicTable, listTables } from '../services/tableService.js';
import { customerReceiptWhatsApp, restaurantPublicInfo } from '../services/whatsappService.js';

export function getConfig(_req, res) {
  res.json({
    appName: config.appName,
    ...restaurantPublicInfo(),
    razorpayEnabled: config.paymentMode === 'razorpay',
    environment: config.env,
  });
}

export function getTable(req, res) {
  const parsed = tableTokenSchema.safeParse(req.params.token);
  if (!parsed.success) throw new AppError(400, 'INVALID_TABLE_TOKEN', 'Invalid table QR code.');
  res.json({ table: getPublicTable(parsed.data) });
}

export function getMenu(req, res) {
  const parsed = tableTokenSchema.safeParse(req.query.tableToken);
  if (!parsed.success) {
    throw new AppError(400, 'TABLE_TOKEN_REQUIRED', 'A valid table token is required.');
  }
  const menu = getMenuForTable(parsed.data);
  res.json({
    menu,
    meta: {
      paymentMode: config.paymentMode,
      simulatedPayments: config.paymentMode === 'simulated',
      taxRatePercent: Number(getSetting('tax_rate_bps', 500)) / 100,
    },
  });
}

export function placeOrder(req, res) {
  const order = createOrder(req.validated.body, req.ip);
  res.status(201).json({ order });
}

export function getOrder(req, res) {
  const token = parseTableToken(req.query.tableToken);
  const order = getCustomerOrder(req.params.publicId, token);
  res.json({ order });
}

export function cancelOrder(req, res) {
  const token = parseTableToken(req.validated.body.tableToken);
  const order = cancelCustomerOrder(req.params.publicId, token, req.ip);
  res.json({ order });
}

export function getWhatsAppReceipt(req, res) {
  const token = parseTableToken(req.query.tableToken);
  res.json(customerReceiptWhatsApp(req.params.publicId, token));
}

export function getDevTables(_req, res) {
  if (!config.enableDevTools) {
    throw new AppError(404, 'NOT_FOUND', 'Development tools are disabled.');
  }
  const tables = listTables().map((table) => ({
    id: table.id,
    tableNumber: table.table_number,
    label: table.label,
    isActive: Boolean(table.is_active),
    token: table.qr_token,
    menuUrl: table.menuUrl,
  }));
  res.json({
    warning: 'Development-only table tokens. These endpoints are disabled in production.',
    tables,
  });
}

function parseTableToken(raw) {
  const result = tableTokenSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError(400, 'TABLE_TOKEN_REQUIRED', 'A valid table token is required.');
  }
  return result.data;
}
