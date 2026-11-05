import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  discountOrder,
  addMenuItem,
  addTable,
  auditLogs,
  editMenuItem,
  editTable,
  menu,
  orderDetail,
  orders,
  paymentDetail,
  payments,
  reconcile,
  refund,
  rotateTable,
  settings,
  summary,
  tableQr,
  tables,
  updateSettings,
} from '../controllers/adminController.js';
import {
  discountSchema as discountValidationSchema,
  menuItemSchema,
  menuItemUpdateSchema,
  settingsSchema,
  tableCreateSchema,
  tableUpdateSchema,
  refundSchema,
} from '../validation/schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/summary', summary);
adminRouter.get('/menu', menu);
adminRouter.post('/menu', validate(menuItemSchema), addMenuItem);
adminRouter.patch('/menu/:id', validate(menuItemUpdateSchema), editMenuItem);

adminRouter.get('/tables', tables);
adminRouter.post('/tables', validate(tableCreateSchema), addTable);
adminRouter.patch('/tables/:id', validate(tableUpdateSchema), editTable);
adminRouter.post('/tables/:id/rotate', rotateTable);
adminRouter.get('/tables/:id/qr', asyncHandler(tableQr));

adminRouter.get('/orders', orders);
adminRouter.get('/orders/:publicId', orderDetail);
adminRouter.patch(
  '/orders/:publicId/discount',
  validate(discountValidationSchema),
  discountOrder,
);

adminRouter.get('/payments', payments);
adminRouter.get('/payments/:id', paymentDetail);
adminRouter.post('/payments/:id/reconcile', asyncHandler(reconcile));
adminRouter.post('/payments/:id/refund', validate(refundSchema), asyncHandler(refund));

adminRouter.get('/settings', settings);
adminRouter.patch('/settings', validate(settingsSchema), updateSettings);
adminRouter.get('/audit-logs', auditLogs);
