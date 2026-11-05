import { createPaymentAttempt, processWebhook, simulatePaymentSuccess, verifyRazorpayPayment } from '../services/paymentService.js';

export async function createPayment(req, res) {
  const result = await createPaymentAttempt(
    req.params.publicId,
    req.validated.body.tableToken,
    req.ip,
  );
  res.status(201).json({ payment: result });
}

export async function verifyPayment(req, res) {
  const result = await verifyRazorpayPayment(req.validated.body, req.ip);
  res.json(result);
}

export function simulatePayment(req, res) {
  const order = simulatePaymentSuccess(
    req.params.publicId,
    req.validated.body.tableToken,
    req.ip,
  );
  res.json({ order });
}

export async function webhook(req, res) {
  const signature = req.get('x-razorpay-signature');
  const result = await processWebhook(req.body, signature);
  res.json(result);
}
