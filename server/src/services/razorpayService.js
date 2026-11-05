import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import { safeCompareHex } from '../utils/ids.js';

let razorpayClient = null;

export function assertRazorpayMode() {
  if (config.paymentMode !== 'razorpay') {
    throw new AppError(
      409,
      'GATEWAY_NOT_ENABLED',
      'Razorpay is not enabled. This server is running in simulated payment mode.',
    );
  }
}

export function getRazorpayClient() {
  assertRazorpayMode();
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpayClient;
}

export async function createGatewayOrder({ amountPaise, receipt, notes }) {
  const client = getRazorpayClient();
  return client.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes,
    payment_capture: 1,
  });
}

export async function fetchGatewayOrder(orderId) {
  const client = getRazorpayClient();
  return client.orders.fetch(orderId);
}

export async function fetchGatewayPayment(paymentId) {
  const client = getRazorpayClient();
  return client.payments.fetch(paymentId);
}

export async function captureGatewayPayment(paymentId, amountPaise) {
  const client = getRazorpayClient();
  return client.payments.capture(paymentId, amountPaise, 'INR');
}

export async function listGatewayPaymentsForOrder(orderId) {
  const client = getRazorpayClient();
  const result = await client.payments.all({ order_id: orderId, count: 100 });
  return result.items || [];
}

export async function createGatewayRefund({ paymentId, amountPaise, notes }) {
  const client = getRazorpayClient();
  return client.refunds.create({
    payment_id: paymentId,
    amount: amountPaise,
    speed: 'normal',
    notes,
  });
}

export function buildCheckoutSignature(orderId, paymentId) {
  return crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function verifyCheckoutSignature(orderId, paymentId, signature) {
  assertRazorpayMode();
  const expected = buildCheckoutSignature(orderId, paymentId);
  return safeCompareHex(expected, signature);
}

export function verifyWebhookSignature(rawBody, signature) {
  assertRazorpayMode();
  if (!signature || !config.razorpay.webhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeCompareHex(expected, signature);
}
