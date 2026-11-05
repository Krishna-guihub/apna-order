import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { orderStatusSchema } from '../validation/schemas.js';
import {
  changeStatus,
  getKitchenWhatsApp,
  getOrder,
  getOrders,
  health,
} from '../controllers/staffController.js';

export const staffRouter = Router();

staffRouter.use(authenticate, requireRole('staff', 'admin'));
staffRouter.get('/health', health);
staffRouter.get('/orders', getOrders);
staffRouter.get('/orders/:publicId', getOrder);
staffRouter.patch('/orders/:publicId/status', validate(orderStatusSchema), changeStatus);
staffRouter.get('/orders/:publicId/whatsapp-kitchen', getKitchenWhatsApp);
