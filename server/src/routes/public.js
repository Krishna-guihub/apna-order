import { Router } from 'express';
import {
  cancelOrder,
  getConfig,
  getDevTables,
  getMenu,
  getOrder,
  getTable,
  getWhatsAppReceipt,
  placeOrder,
} from '../controllers/publicController.js';
import { validate } from '../middleware/validate.js';
import { orderLimiter } from '../middleware/rateLimiters.js';
import { placeOrderSchema, tableTokenBodySchema } from '../validation/schemas.js';

export const publicRouter = Router();

publicRouter.get('/config', getConfig);
publicRouter.get('/tables/:token', getTable);
publicRouter.get('/menu', getMenu);
publicRouter.get('/dev/tables', getDevTables);
publicRouter.post('/orders', orderLimiter, validate(placeOrderSchema), placeOrder);
publicRouter.get('/orders/:publicId', getOrder);
publicRouter.post('/orders/:publicId/cancel', validate(tableTokenBodySchema), cancelOrder);
publicRouter.get('/orders/:publicId/whatsapp-receipt', getWhatsAppReceipt);
