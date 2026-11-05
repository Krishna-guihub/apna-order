import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, nowIso, transaction } from '../db.js';
import { AppError, badRequest, conflict, notFound } from '../utils/errors.js';
import { requireTableByToken } from './tableService.js';
import { getCustomerOrder, mapPayment } from './orderService.js';
import { logAudit } from './auditService.js';
import {
  assertRazorpayMode,
  captureGatewayPayment,
  createGatewayOrder,
  createGatewayRefund,
  fetchGatewayOrder,
  fetchGatewayPayment,
  listGatewayPaymentsForOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from './razorpayService.js';

function getOrderForPayment(publicId, tableId = null) {
  const row = db
    .prepare(`
      SELECT o.*, t.table_number
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.public_id = ?
    `)
    .get(publicId);
  if (!row) throw notFound('Order not found.');
  if (tableId !== null && row.table_id !== tableId) throw notFound('Order not found for this table.');
  return row;
}

function getPaymentWithOrder(paymentId) {
  const row = db
    .prepare(`
      SELECT p.*, o.public_id, o.total_paise AS order_total_paise, o.payment_status AS order_payment_status,
             o.status AS order_status, o.table_id, t.table_number
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      JOIN restaurant_tables t ON t.id = o.table_id
      WHERE p.id = ?
    `)
    .get(paymentId);
  if (!row) throw notFound('Payment not found.');
  return row;
}

function getPaymentForOrder(orderId) {
  return db.prepare('SELECT * FROM payments WHERE order_id = ?').get(orderId) || null;
}

function updateOrderPaymentStatus(orderId, status) {
  db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').run(
    status,
    nowIso(),
    orderId,
  );
}

function markGatewayFailure(paymentRow, reason, rawResponse) {
  const timestamp = nowIso();
  db.prepare(`
    UPDATE payments
    SET status = 'FAILED', failure_reason = ?, raw_response_json = ?, updated_at = ?
    WHERE id = ? AND status <> 'PAID'
  `).run(reason.slice(0, 500), JSON.stringify(rawResponse || {}).slice(0, 20000), timestamp, paymentRow.id);

  if (paymentRow.order_payment_status === 'PAYMENT_PENDING') {
    updateOrderPaymentStatus(paymentRow.order_id, 'UNPAID');
  }
}

export function markPaymentPaid(paymentId, {
  providerPaymentId = null,
  signature = null,
  verifiedVia,
  method = null,
  rawResponse = null,
}) {
  return transaction(() => {
    const payment = getPaymentWithOrder(paymentId);
    if (!payment) throw notFound('Payment not found.');

    if (payment.status === 'PAID') {
      if (providerPaymentId && payment.provider_payment_id !== providerPaymentId) {
        throw conflict('This order is already linked to a different successful payment.');
      }
      return mapPayment(payment);
    }

    if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
      throw conflict('This payment has already been settled with a refund.');
    }

    if (payment.amount_paise !== payment.order_total_paise) {
      throw conflict('Payment amount does not match the server-calculated order total.');
    }

    const timestamp = nowIso();
    const signatureVerified = ['checkout_signature', 'webhook'].includes(verifiedVia) ? 1 : 0;

    if (providerPaymentId) {
      const duplicate = db
        .prepare('SELECT id, order_id FROM payments WHERE provider_payment_id = ? AND id <> ?')
        .get(providerPaymentId, payment.id);
      if (duplicate) {
        throw conflict('This gateway payment is already associated with another order.');
      }
    }

    db.prepare(`
      UPDATE payments
      SET status = 'PAID',
          provider_payment_id = COALESCE(?, provider_payment_id),
          provider_signature = COALESCE(?, provider_signature),
          signature_verified = ?,
          verified_via = ?,
          method = COALESCE(?, method),
          failure_reason = NULL,
          raw_response_json = ?,
          paid_at = ?,
          updated_at = ?
      WHERE id = ? AND status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
    `).run(
      providerPaymentId,
      signature,
      signatureVerified,
      verifiedVia,
      method,
      rawResponse ? JSON.stringify(rawResponse).slice(0, 30000) : null,
      timestamp,
      timestamp,
      payment.id,
    );

    updateOrderPaymentStatus(payment.order_id, 'PAID');

    logAudit({
      actorRole: verifiedVia === 'simulation' ? 'system' : 'payment_gateway',
      action: 'PAYMENT_MARKED_PAID',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        orderPublicId: payment.public_id,
        provider: payment.provider,
        verifiedVia,
        amountPaise: payment.amount_paise,
        providerPaymentId,
      },
    });

    return mapPayment(getPaymentWithOrder(payment.id));
  });
}

export async function createPaymentAttempt(publicId, tableToken, ipAddress) {
  const table = requireTableByToken(tableToken);
  const order = getOrderForPayment(publicId, table.id);

  if (order.status === 'CANCELLED') throw conflict('Cancelled orders cannot be paid.');
  if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.payment_status)) {
    throw conflict('This order has already been settled.');
  }
  if (order.total_paise <= 0) throw badRequest('Order total must be greater than zero.');

  let existing = getPaymentForOrder(order.id);

  if (config.paymentMode === 'simulated') {
    if (config.isProduction) throw conflict('Simulated payments are disabled in production.');
    if (
      existing &&
      existing.provider === 'simulated' &&
      ['CREATED', 'PENDING'].includes(existing.status) &&
      existing.amount_paise === order.total_paise
    ) {
      updateOrderPaymentStatus(order.id, 'PAYMENT_PENDING');
      return {
        mode: 'simulated',
        paymentId: existing.id,
        providerOrderId: existing.provider_order_id,
        amountPaise: order.total_paise,
        currency: 'INR',
        warning: 'Simulated payment: no money moves and no gateway verification occurs.',
      };
    }

    const timestamp = nowIso();
    const providerOrderId = `sim_${crypto.randomUUID()}`;
    transaction(() => {
      if (existing) {
        db.prepare(`
          UPDATE payments
          SET provider = 'simulated',
              provider_order_id = ?,
              provider_payment_id = NULL,
              provider_signature = NULL,
              amount_paise = ?,
              currency = 'INR',
              status = 'CREATED',
              is_simulated = 1,
              signature_verified = 0,
              verified_via = NULL,
              method = NULL,
              failure_reason = NULL,
              raw_response_json = NULL,
              paid_at = NULL,
              updated_at = ?
          WHERE id = ?
        `).run(providerOrderId, order.total_paise, timestamp, existing.id);
      } else {
        db.prepare(`
          INSERT INTO payments
            (order_id, provider, provider_order_id, amount_paise, currency, status,
             is_simulated, signature_verified, created_at, updated_at)
          VALUES (?, 'simulated', ?, ?, 'INR', 'CREATED', 1, 0, ?, ?)
        `).run(order.id, providerOrderId, order.total_paise, timestamp, timestamp);
      }
      updateOrderPaymentStatus(order.id, 'PAYMENT_PENDING');
    });
    existing = getPaymentForOrder(order.id);
    logAudit({
      actorRole: 'customer',
      action: 'PAYMENT_ATTEMPT_CREATED',
      entityType: 'payment',
      entityId: existing.id,
      metadata: { orderPublicId: publicId, mode: 'simulated', amountPaise: order.total_paise },
      ipAddress,
    });
    return {
      mode: 'simulated',
      paymentId: existing.id,
      providerOrderId,
      amountPaise: order.total_paise,
      currency: 'INR',
      warning: 'Simulated payment: no money moves and no gateway verification occurs.',
    };
  }

  assertRazorpayMode();

  if (
    existing &&
    existing.provider === 'razorpay' &&
    ['CREATED', 'PENDING'].includes(existing.status) &&
    existing.amount_paise === order.total_paise &&
    existing.provider_order_id
  ) {
    updateOrderPaymentStatus(order.id, 'PAYMENT_PENDING');
    return {
      mode: 'razorpay',
      paymentId: existing.id,
      keyId: config.razorpay.keyId,
      providerOrderId: existing.provider_order_id,
      amountPaise: order.total_paise,
      currency: 'INR',
      checkoutName: config.appName,
    };
  }

  const gatewayOrder = await createGatewayOrder({
    amountPaise: order.total_paise,
    receipt: order.public_id,
    notes: {
      order_public_id: order.public_id,
      table_number: String(order.table_number),
    },
  });

  const timestamp = nowIso();
  transaction(() => {
    if (existing) {
      db.prepare(`
        UPDATE payments
        SET provider = 'razorpay',
            provider_order_id = ?,
            provider_payment_id = NULL,
            provider_signature = NULL,
            amount_paise = ?,
            currency = ?,
            status = 'CREATED',
            is_simulated = 0,
            signature_verified = 0,
            verified_via = NULL,
            method = NULL,
            failure_reason = NULL,
            raw_response_json = ?,
            paid_at = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(
        gatewayOrder.id,
        order.total_paise,
        gatewayOrder.currency || 'INR',
        JSON.stringify(gatewayOrder).slice(0, 20000),
        timestamp,
        existing.id,
      );
    } else {
      db.prepare(`
        INSERT INTO payments
          (order_id, provider, provider_order_id, amount_paise, currency, status,
           is_simulated, signature_verified, raw_response_json, created_at, updated_at)
        VALUES (?, 'razorpay', ?, ?, ?, 'CREATED', 0, 0, ?, ?, ?)
      `).run(
        order.id,
        gatewayOrder.id,
        order.total_paise,
        gatewayOrder.currency || 'INR',
        JSON.stringify(gatewayOrder).slice(0, 20000),
        timestamp,
        timestamp,
      );
    }
    updateOrderPaymentStatus(order.id, 'PAYMENT_PENDING');
  });

  const payment = getPaymentForOrder(order.id);
  logAudit({
    actorRole: 'customer',
    action: 'PAYMENT_ATTEMPT_CREATED',
    entityType: 'payment',
    entityId: payment.id,
    metadata: {
      orderPublicId: publicId,
      mode: 'razorpay',
      amountPaise: order.total_paise,
      providerOrderId: gatewayOrder.id,
    },
    ipAddress,
  });

  return {
    mode: 'razorpay',
    paymentId: payment.id,
    keyId: config.razorpay.keyId,
    providerOrderId: gatewayOrder.id,
    amountPaise: order.total_paise,
    currency: gatewayOrder.currency || 'INR',
    checkoutName: config.appName,
  };
}

export function simulatePaymentSuccess(publicId, tableToken, ipAddress) {
  if (config.paymentMode !== 'simulated' || config.isProduction) {
    throw conflict('Simulated payments are not available on this server.');
  }
  const table = requireTableByToken(tableToken);
  const order = getOrderForPayment(publicId, table.id);
  const payment = getPaymentForOrder(order.id);
  if (!payment) throw notFound('Start a simulated payment attempt first.');
  if (payment.provider !== 'simulated') {
    throw conflict('This payment attempt belongs to a real gateway.');
  }
  if (payment.status === 'PAID') return getCustomerOrder(publicId, tableToken);

  markPaymentPaid(payment.id, {
    providerPaymentId: `sim_pay_${crypto.randomUUID()}`,
    verifiedVia: 'simulation',
    method: 'simulated',
    rawResponse: { simulated: true, warning: 'No real money moved.' },
  });

  logAudit({
    actorRole: 'customer',
    action: 'SIMULATED_PAYMENT_COMPLETED',
    entityType: 'payment',
    entityId: payment.id,
    metadata: { orderPublicId: publicId, amountPaise: payment.amount_paise },
    ipAddress,
  });

  return getCustomerOrder(publicId, tableToken);
}

export async function verifyRazorpayPayment(payload, ipAddress) {
  assertRazorpayMode();
  const existing = db
    .prepare('SELECT * FROM payments WHERE provider_order_id = ?')
    .get(payload.razorpay_order_id);
  if (!existing) throw notFound('Payment attempt not found.');

  const signatureValid = verifyCheckoutSignature(
    payload.razorpay_order_id,
    payload.razorpay_payment_id,
    payload.razorpay_signature,
  );
  if (!signatureValid) {
    logAudit({
      actorRole: 'customer',
      action: 'PAYMENT_SIGNATURE_REJECTED',
      entityType: 'payment',
      entityId: existing.id,
      metadata: { providerOrderId: payload.razorpay_order_id },
      ipAddress,
    });
    throw badRequest('Payment signature verification failed. No payment has been marked as paid.');
  }

  if (existing.status === 'PAID') {
    if (existing.provider_payment_id !== payload.razorpay_payment_id) {
      throw conflict('This order was already paid with a different gateway payment.');
    }
    const order = db.prepare('SELECT public_id FROM orders WHERE id = ?').get(existing.order_id);
    const tokenRow = db
      .prepare(`
        SELECT t.qr_token
        FROM orders o JOIN restaurant_tables t ON t.id = o.table_id
        WHERE o.id = ?
      `)
      .get(existing.order_id);
    return { verified: true, duplicate: true, order: getCustomerOrder(order.public_id, tokenRow.qr_token) };
  }

  const gatewayOrder = await fetchGatewayOrder(payload.razorpay_order_id);
  const notes = gatewayOrder.notes || {};
  const expectedOrderId = db
    .prepare('SELECT public_id, total_paise FROM orders WHERE id = ?')
    .get(existing.order_id);
  if (!expectedOrderId) throw notFound('Local order not found.');
  if (notes.order_public_id && notes.order_public_id !== expectedOrderId.public_id) {
    throw conflict('Gateway order is not associated with the expected local order.');
  }
  if (Number(gatewayOrder.amount) !== existing.amount_paise) {
    throw conflict('Gateway order amount does not match the stored payment amount.');
  }
  if ((gatewayOrder.currency || 'INR') !== existing.currency) {
    throw conflict('Gateway order currency does not match.');
  }

  let gatewayPayment = await fetchGatewayPayment(payload.razorpay_payment_id);
  if (gatewayPayment.order_id !== payload.razorpay_order_id) {
    throw conflict('Gateway payment is not linked to the supplied gateway order.');
  }
  if (Number(gatewayPayment.amount) !== existing.amount_paise) {
    throw conflict('Paid amount does not match the server-calculated order total.');
  }
  if ((gatewayPayment.currency || 'INR') !== existing.currency) {
    throw conflict('Paid currency does not match the order currency.');
  }

  if (gatewayPayment.status === 'authorized') {
    await captureGatewayPayment(gatewayPayment.id, existing.amount_paise);
    gatewayPayment = await fetchGatewayPayment(payload.razorpay_payment_id);
  }

  if (gatewayPayment.status !== 'captured') {
    if (gatewayPayment.status === 'failed') {
      markGatewayFailure(existing, gatewayPayment.error_description || 'Gateway payment failed', gatewayPayment);
    }
    throw conflict(
      `Payment is currently "${gatewayPayment.status}", not captured. No payment has been marked as paid.`,
    );
  }

  markPaymentPaid(existing.id, {
    providerPaymentId: gatewayPayment.id,
    signature: payload.razorpay_signature,
    verifiedVia: 'checkout_signature',
    method: gatewayPayment.method,
    rawResponse: gatewayPayment,
  });

  logAudit({
    actorRole: 'customer',
    action: 'PAYMENT_VERIFIED',
    entityType: 'payment',
    entityId: existing.id,
    metadata: {
      orderPublicId: expectedOrderId.public_id,
      providerPaymentId: gatewayPayment.id,
      amountPaise: existing.amount_paise,
      gatewayStatus: gatewayPayment.status,
    },
    ipAddress,
  });

  const tokenRow = db
    .prepare(`
      SELECT t.qr_token
      FROM orders o JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.id = ?
    `)
    .get(existing.order_id);

  return {
    verified: true,
    duplicate: false,
    order: getCustomerOrder(expectedOrderId.public_id, tokenRow.qr_token),
  };
}

function setRefundStatusFromGateway(refundRow, gatewayStatus, rawResponse) {
  const mapped =
    gatewayStatus === 'processed' ? 'PROCESSED' : gatewayStatus === 'failed' ? 'FAILED' : 'PENDING';
  db.prepare(`
    UPDATE refunds SET status = ?, raw_response_json = ?, updated_at = ? WHERE id = ?
  `).run(mapped, JSON.stringify(rawResponse || {}).slice(0, 20000), nowIso(), refundRow.id);
  recalculateRefundTotals(refundRow.payment_id);
}

export function recalculateRefundTotals(paymentId) {
  const payment = getPaymentWithOrder(paymentId);
  if (!payment) throw notFound('Payment not found.');
  const refunds = db
    .prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'PROCESSED' THEN amount_paise ELSE 0 END), 0) AS processed,
        COALESCE(SUM(CASE WHEN status IN ('PROCESSED', 'PENDING') THEN amount_paise ELSE 0 END), 0) AS reserved
      FROM refunds
      WHERE payment_id = ?
    `)
    .get(paymentId);

  let status = payment.status;
  if (refunds.processed >= payment.amount_paise) status = 'REFUNDED';
  else if (refunds.processed > 0) status = 'PARTIALLY_REFUNDED';
  else if (['REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) status = 'PAID';

  if (!['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(status)) return payment;

  db.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?').run(
    status,
    nowIso(),
    paymentId,
  );
  updateOrderPaymentStatus(payment.order_id, status);
  return {
    ...payment,
    status,
    refundedPaise: Number(refunds.processed),
    reservedRefundPaise: Number(refunds.reserved),
  };
}

export function mapRefund(row) {
  return {
    id: row.id,
    paymentId: row.payment_id,
    orderPublicId: row.public_id || null,
    providerRefundId: row.provider_refund_id,
    requestKey: row.request_key,
    amountPaise: row.amount_paise,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function refundPayment(paymentId, { amountPaise, reason }, requestKey, user, ipAddress) {
  const payment = getPaymentWithOrder(paymentId);
  if (!['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
    throw conflict('Only a successfully paid payment can be refunded.');
  }
  if (payment.provider === 'simulated' && config.isProduction) {
    throw conflict('Simulated payments cannot be refunded in production.');
  }

  const existing = db
    .prepare('SELECT * FROM refunds WHERE payment_id = ? AND request_key = ?')
    .get(paymentId, requestKey);
  if (existing) {
    return { duplicate: true, refund: mapRefund({ ...existing, public_id: payment.public_id }) };
  }

  const reserved = db
    .prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) AS total
      FROM refunds
      WHERE payment_id = ? AND status IN ('PENDING', 'PROCESSED')
    `)
    .get(paymentId).total;
  if (reserved + amountPaise > payment.amount_paise) {
    throw conflict(
      `Refund exceeds the remaining refundable amount of ₹${((payment.amount_paise - reserved) / 100).toFixed(2)}.`,
    );
  }

  const timestamp = nowIso();
  let refundResult;
  try {
    refundResult = db
      .prepare(`
        INSERT INTO refunds
          (payment_id, request_key, amount_paise, reason, status, initiated_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)
      `)
      .run(paymentId, requestKey, amountPaise, reason, user.id, timestamp, timestamp);
  } catch (error) {
    if (String(error.message).includes('UNIQUE constraint failed')) {
      const duplicate = db
        .prepare('SELECT * FROM refunds WHERE payment_id = ? AND request_key = ?')
        .get(paymentId, requestKey);
      return { duplicate: true, refund: mapRefund({ ...duplicate, public_id: payment.public_id }) };
    }
    throw error;
  }

  const refundId = Number(refundResult.lastInsertRowid);
  let refundRow = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);

  if (payment.provider === 'simulated') {
    db.prepare(`
      UPDATE refunds
      SET status = 'PROCESSED', provider_refund_id = ?, raw_response_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      `sim_refund_${crypto.randomUUID()}`,
      JSON.stringify({ simulated: true, warning: 'No real money was refunded.' }),
      nowIso(),
      refundId,
    );
    recalculateRefundTotals(paymentId);
    refundRow = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
  } else {
    try {
      const gatewayRefund = await createGatewayRefund({
        paymentId: payment.provider_payment_id,
        amountPaise,
        notes: { order_public_id: payment.public_id, reason },
      });
      db.prepare(`
        UPDATE refunds
        SET provider_refund_id = ?, raw_response_json = ?, updated_at = ?
        WHERE id = ?
      `).run(gatewayRefund.id, JSON.stringify(gatewayRefund).slice(0, 20000), nowIso(), refundId);
      refundRow = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
      setRefundStatusFromGateway(refundRow, gatewayRefund.status, gatewayRefund);
      refundRow = db.prepare('SELECT * FROM refunds WHERE id = ?').get(refundId);
    } catch (error) {
      db.prepare(`
        UPDATE refunds SET status = 'FAILED', raw_response_json = ?, updated_at = ? WHERE id = ?
      `).run(JSON.stringify({ error: error.message }).slice(0, 20000), nowIso(), refundId);
      logAudit({
        userId: user.id,
        actorRole: user.role,
        action: 'REFUND_FAILED',
        entityType: 'payment',
        entityId: paymentId,
        metadata: { amountPaise, error: error.message },
        ipAddress,
      });
      throw new AppError(502, 'REFUND_FAILED', 'The gateway did not accept the refund. No refund was recorded as successful.');
    }
  }

  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'REFUND_INITIATED',
    entityType: 'payment',
    entityId: paymentId,
    metadata: {
      orderPublicId: payment.public_id,
      refundId,
      amountPaise,
      reason,
      provider: payment.provider,
      status: refundRow.status,
    },
    ipAddress,
  });

  return {
    duplicate: false,
    refund: mapRefund({ ...refundRow, public_id: payment.public_id }),
  };
}

export async function reconcilePayment(paymentId, user, ipAddress) {
  assertRazorpayMode();
  const payment = getPaymentWithOrder(paymentId);
  if (payment.provider !== 'razorpay') {
    throw conflict('Only Razorpay payments can be reconciled with the gateway.');
  }
  if (payment.status === 'PAID') {
    return { action: 'already_paid', payment: mapPayment(payment) };
  }
  if (!payment.provider_order_id) {
    throw conflict('This payment has no gateway order to reconcile.');
  }

  const gatewayOrder = await fetchGatewayOrder(payment.provider_order_id);
  if (Number(gatewayOrder.amount) !== payment.amount_paise) {
    throw conflict('Gateway order amount differs from the local payment amount. Manual investigation required.');
  }
  const gatewayPayments = await listGatewayPaymentsForOrder(payment.provider_order_id);
  const captured = gatewayPayments.find(
    (item) =>
      item.status === 'captured' &&
      Number(item.amount) === payment.amount_paise &&
      (item.currency || 'INR') === payment.currency,
  );

  if (captured) {
    markPaymentPaid(payment.id, {
      providerPaymentId: captured.id,
      verifiedVia: 'reconciliation',
      method: captured.method,
      rawResponse: captured,
    });
    logAudit({
      userId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_RECONCILED',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        orderPublicId: payment.public_id,
        providerPaymentId: captured.id,
        amountPaise: payment.amount_paise,
      },
      ipAddress,
    });
    return { action: 'marked_paid', payment: mapPayment(getPaymentWithOrder(payment.id)) };
  }

  const failed = gatewayPayments.find((item) => item.status === 'failed');
  if (failed && !['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
    markGatewayFailure(payment, failed.error_description || 'Gateway payment failed', failed);
    logAudit({
      userId: user.id,
      actorRole: user.role,
      action: 'PAYMENT_RECONCILED_FAILED',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { orderPublicId: payment.public_id },
      ipAddress,
    });
    return { action: 'marked_failed', payment: mapPayment(getPaymentWithOrder(payment.id)) };
  }

  return { action: 'still_pending', payment: mapPayment(payment) };
}

export async function reconcilePendingPayments() {
  if (config.paymentMode !== 'razorpay') return;
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const pending = db
    .prepare(`
      SELECT p.id
      FROM payments p
      WHERE p.provider = 'razorpay'
        AND p.status IN ('CREATED', 'PENDING')
        AND p.created_at < ?
        AND p.provider_order_id IS NOT NULL
      ORDER BY p.created_at ASC
      LIMIT 20
    `)
    .all(cutoff);

  for (const payment of pending) {
    try {
      await reconcilePayment(
        payment.id,
        { id: null, role: 'system' },
        'payment-reconciliation-job',
      );
    } catch (error) {
      console.error(`[reconcile] Payment ${payment.id} failed:`, error.message);
    }
  }
}

export function startReconciliationJob() {
  if (config.paymentMode !== 'razorpay') return null;
  const interval = setInterval(
    () => {
      reconcilePendingPayments().catch((error) => {
        console.error('[reconcile] Scheduled reconciliation failed:', error.message);
      });
    },
    config.reconcileMinutes * 60 * 1000,
  );
  interval.unref();
  return interval;
}

export function getPaymentByProviderOrder(providerOrderId) {
  return db.prepare('SELECT * FROM payments WHERE provider_order_id = ?').get(providerOrderId);
}

export function getPaymentDetailsAdmin(paymentId) {
  return mapPayment(getPaymentWithOrder(paymentId));
}

export async function processWebhook(rawBody, signature) {
  if (config.paymentMode !== 'razorpay') {
    throw new AppError(409, 'WEBHOOK_DISABLED', 'Webhooks are only accepted in Razorpay mode.');
  }
  const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  if (!verifyWebhookSignature(rawBuffer, signature)) {
    logAudit({
      actorRole: 'payment_gateway',
      action: 'WEBHOOK_SIGNATURE_REJECTED',
      entityType: 'payment_webhook',
      entityId: null,
      metadata: { reason: 'Invalid HMAC signature' },
    });
    throw badRequest('Invalid webhook signature.');
  }

  let payload;
  try {
    payload = JSON.parse(rawBuffer.toString('utf8'));
  } catch {
    throw badRequest('Webhook body is not valid JSON.');
  }

  if (!payload?.id || !payload?.event) {
    throw badRequest('Webhook is missing an event ID or event type.');
  }

  const existingEvent = db
    .prepare('SELECT * FROM payment_webhook_events WHERE event_id = ?')
    .get(payload.id);
  if (existingEvent?.processed) {
    return { received: true, duplicate: true, eventId: payload.id };
  }

  let eventRowId;
  if (!existingEvent) {
    const result = db
      .prepare(`
        INSERT INTO payment_webhook_events
          (event_id, event_type, signature_verified, processed, payload_json, received_at)
        VALUES (?, ?, 1, 0, ?, ?)
      `)
      .run(payload.id, payload.event, JSON.stringify(payload).slice(0, 100000), nowIso());
    eventRowId = Number(result.lastInsertRowid);
  } else {
    eventRowId = existingEvent.id;
    db.prepare(`
      UPDATE payment_webhook_events
      SET payload_json = ?, signature_verified = 1, error_message = NULL
      WHERE id = ?
    `).run(JSON.stringify(payload).slice(0, 100000), eventRowId);
  }

  try {
    const handled = handleWebhookEvent(payload);
    db.prepare(`
      UPDATE payment_webhook_events
      SET processed = 1, processed_at = ?, error_message = NULL
      WHERE id = ?
    `).run(nowIso(), eventRowId);
    return { received: true, duplicate: false, handled, eventId: payload.id };
  } catch (error) {
    db.prepare(`
      UPDATE payment_webhook_events SET processed = 0, error_message = ? WHERE id = ?
    `).run(String(error.message).slice(0, 1000), eventRowId);
    throw error;
  }
}

function handleWebhookEvent(payload) {
  const type = payload.event;
  const entity = payload.payload?.payment?.entity;
  const refundEntity = payload.payload?.refund?.entity;

  if (type.startsWith('payment.') && entity) {
    const local = db
      .prepare('SELECT * FROM payments WHERE provider_order_id = ? OR provider_payment_id = ?')
      .get(entity.order_id, entity.id);
    if (!local) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Webhook payment is not linked to a local payment.');
    }

    if (Number(entity.amount) !== local.amount_paise) {
      throw conflict('Webhook amount does not match the local payment amount.');
    }
    if ((entity.currency || 'INR') !== local.currency) {
      throw conflict('Webhook currency does not match the local payment currency.');
    }

    if (type === 'payment.captured' || type === 'order.paid') {
      if (local.status === 'PAID') {
        return { action: 'already_paid', paymentId: local.id };
      }
      if (entity.status !== 'captured') {
        throw conflict('Webhook says payment captured but gateway status is not captured.');
      }
      markPaymentPaid(local.id, {
        providerPaymentId: entity.id,
        signature: null,
        verifiedVia: 'webhook',
        method: entity.method,
        rawResponse: entity,
      });
      logAudit({
        actorRole: 'payment_gateway',
        action: 'WEBHOOK_PAYMENT_CAPTURED',
        entityType: 'payment',
        entityId: local.id,
        metadata: {
          eventId: payload.id,
          orderPublicId: local.public_id,
          providerPaymentId: entity.id,
          amountPaise: local.amount_paise,
        },
      });
      return { action: 'payment_paid', paymentId: local.id };
    }

    if (type === 'payment.failed') {
      if (local.status === 'PAID') return { action: 'ignored_already_paid', paymentId: local.id };
      const withOrder = getPaymentWithOrder(local.id);
      markGatewayFailure(withOrder, entity.error_description || 'Gateway reported failure', entity);
      logAudit({
        actorRole: 'payment_gateway',
        action: 'WEBHOOK_PAYMENT_FAILED',
        entityType: 'payment',
        entityId: local.id,
        metadata: { eventId: payload.id, orderPublicId: local.public_id },
      });
      return { action: 'payment_failed', paymentId: local.id };
    }

    return { action: 'ignored_event', type };
  }

  if (type.startsWith('refund.') && refundEntity) {
    const local = db
      .prepare('SELECT * FROM payments WHERE provider_payment_id = ?')
      .get(refundEntity.payment_id);
    if (!local) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Refund webhook is not linked to a local payment.');
    }

    const existingRefund = db
      .prepare('SELECT * FROM refunds WHERE provider_refund_id = ?')
      .get(refundEntity.id);

    const status =
      type === 'refund.processed' ? 'PROCESSED' : type === 'refund.failed' ? 'FAILED' : 'PENDING';

    if (existingRefund) {
      db.prepare(`
        UPDATE refunds SET status = ?, raw_response_json = ?, updated_at = ? WHERE id = ?
      `).run(status, JSON.stringify(refundEntity).slice(0, 20000), nowIso(), existingRefund.id);
    } else {
      db.prepare(`
        INSERT INTO refunds
          (payment_id, provider_refund_id, request_key, amount_paise, reason, status,
           raw_response_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        local.id,
        refundEntity.id,
        `webhook:${payload.id}`.slice(0, 120),
        Number(refundEntity.amount),
        refundEntity.notes?.reason || 'Refund reported by gateway webhook',
        status,
        JSON.stringify(refundEntity).slice(0, 20000),
        nowIso(),
        nowIso(),
      );
    }
    recalculateRefundTotals(local.id);
    logAudit({
      actorRole: 'payment_gateway',
      action: `WEBHOOK_REFUND_${status}`,
      entityType: 'payment',
      entityId: local.id,
      metadata: {
        eventId: payload.id,
        providerRefundId: refundEntity.id,
        amountPaise: Number(refundEntity.amount),
      },
    });
    return { action: `refund_${status.toLowerCase()}`, paymentId: local.id };
  }

  return { action: 'ignored_event', type };
}
