import { Router } from 'express';
import { createPayment, simulatePayment, verifyPayment } from '../controllers/paymentController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paymentLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import {
  simulatedPaymentSchema,
  tableTokenBodySchema,
  verifyPaymentSchema,
} from '../validation/schemas.js';

export const paymentRouter = Router();

paymentRouter.post(
  '/orders/:publicId',
  paymentLimiter,
  validate(tableTokenBodySchema),
  asyncHandler(createPayment),
);

paymentRouter.post(
  '/orders/:publicId/simulate',
  paymentLimiter,
  validate(simulatedPaymentSchema),
  simulatePayment,
);

paymentRouter.post(
  '/verify',
  paymentLimiter,
  validate(verifyPaymentSchema),
  asyncHandler(verifyPayment),
);
