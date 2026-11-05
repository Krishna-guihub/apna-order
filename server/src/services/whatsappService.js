import { config } from '../config.js';
import { db, getSetting } from '../db.js';
import { conflict, notFound } from '../utils/errors.js';
import { requireTableByToken } from './tableService.js';
import { getCustomerOrder } from './orderService.js';

function money(paise) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

function whatsappUrl(number, message) {
  const digits = String(number || '').replace(/[^\d]/g, '');
  if (digits.length < 10) {
    throw conflict('WhatsApp is not configured. Ask an administrator to set a WhatsApp number.');
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function kitchenWhatsAppForOrder(publicId) {
  const row = db
    .prepare(`
      SELECT o.*, t.table_number
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.public_id = ?
    `)
    .get(publicId);
  if (!row) throw notFound('Order not found.');
  const items = db
    .prepare('SELECT item_name, quantity FROM order_items WHERE order_id = ? ORDER BY id')
    .all(row.id);

  const itemLines = items.map((item) => `• ${item.quantity} × ${item.item_name}`).join('\n');
  const message = [
    `🔥 NEW KITCHEN ORDER — ${config.appName}`,
    '',
    `Order: ${row.public_id}`,
    `Table: ${row.table_number}`,
    `Customer: ${row.customer_name}`,
    `Placed: ${new Date(row.created_at).toLocaleString('en-IN')}`,
    '',
    itemLines,
    '',
    `Notes: ${row.notes || 'None'}`,
    `Order total: ${money(row.total_paise)}`,
    `Payment: ${row.payment_status}`,
    '',
    'Please confirm preparation in the kitchen dashboard.',
  ].join('\n');

  return {
    url: whatsappUrl(getSetting('whatsapp_kitchen_number', config.whatsapp.kitchenNumber), message),
    manualSendRequired: true,
    instructions:
      'WhatsApp will open with this message prefilled. You must review it and press Send manually. Nothing is sent automatically.',
  };
}

export function customerReceiptWhatsApp(publicId, tableToken) {
  const table = requireTableByToken(tableToken);
  const order = getCustomerOrder(publicId, tableToken);

  if (!order.hasVerifiedPayment || order.paymentStatus !== 'PAID') {
    throw conflict('A WhatsApp receipt is available only after a verified successful payment.');
  }
  if (order.payment?.isSimulated && config.isProduction) {
    throw conflict('Simulated payment receipts are disabled in production.');
  }

  const itemLines = order.items
    .map((item) => `• ${item.quantity} × ${item.name} — ${money(item.lineTotalPaise)}`)
    .join('\n');

  const paymentLabel = order.payment.isSimulated
    ? 'SIMULATED PAYMENT — development mode only, no money moved'
    : `PAID — verified via ${order.payment.verifiedVia.replaceAll('_', ' ')}`;

  const message = [
    `🧾 ${getSetting('restaurant_name', config.appName)} — Receipt`,
    '',
    `Order: ${order.publicId}`,
    `Table: ${table.table_number}`,
    `Customer: ${order.customerName}`,
    `Date: ${new Date(order.createdAt).toLocaleString('en-IN')}`,
    '',
    itemLines,
    '',
    `Subtotal: ${money(order.subtotalPaise)}`,
    order.discountPaise > 0 ? `Discount: −${money(order.discountPaise)}` : null,
    `Tax (${order.taxRatePercent}%): ${money(order.taxPaise)}`,
    `TOTAL: ${money(order.totalPaise)}`,
    '',
    `Payment: ${paymentLabel}`,
    order.payment.providerPaymentId ? `Gateway payment ID: ${order.payment.providerPaymentId}` : null,
    '',
    'Thank you for dining with us. This receipt reflects the verified status in our billing system.',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    url: whatsappUrl(
      getSetting('whatsapp_restaurant_number', config.whatsapp.restaurantNumber),
      message,
    ),
    manualSendRequired: true,
    instructions:
      'WhatsApp will open with the receipt prefilled. Press Send manually in WhatsApp. This app does not send messages automatically.',
    simulated: Boolean(order.payment.isSimulated),
  };
}

export function restaurantPublicInfo() {
  return {
    restaurantName: getSetting('restaurant_name', config.appName),
    taxRatePercent: Number(getSetting('tax_rate_bps', 500)) / 100,
    paymentMode: config.paymentMode,
    simulatedPayments: config.paymentMode === 'simulated',
    devToolsEnabled: config.enableDevTools,
  };
}
