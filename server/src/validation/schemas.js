import { z } from 'zod';

export const tableTokenSchema = z.string().min(32).max(128);
export const publicOrderIdSchema = z.string().regex(/^AO-\d{8}-[A-F0-9]{6}$/);

const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine((value) => value === '' || /^[+]?[\d\s()-]{7,20}$/.test(value), {
    message: 'Enter a valid phone number.',
  })
  .optional();

export const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

export const placeOrderSchema = z.object({
  tableToken: tableTokenSchema,
  customerName: z.string().trim().min(2).max(80),
  customerPhone: phoneSchema,
  notes: z.string().trim().max(300).optional().default(''),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(40),
});

export const tableTokenBodySchema = z.object({
  tableToken: tableTokenSchema,
});

export const orderStatusSchema = z.object({
  status: z.enum(['PLACED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
});

export const menuItemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional().default(''),
  pricePaise: z.number().int().min(100).max(10000000),
  category: z.string().trim().min(2).max(60),
  isVeg: z.boolean(),
  imageUrl: z.string().trim().url().max(1000).or(z.literal('')).optional().default(''),
  isAvailable: z.boolean().optional().default(true),
  prepMinutes: z.number().int().min(1).max(180).optional().default(15),
});

export const menuItemUpdateSchema = menuItemSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const tableCreateSchema = z.object({
  tableNumber: z.number().int().min(1).max(999),
  label: z.string().trim().max(80).optional().default(''),
});

export const tableUpdateSchema = z.object({
  isActive: z.boolean(),
  label: z.string().trim().max(80).optional(),
});

export const settingsSchema = z.object({
  restaurantName: z.string().trim().min(2).max(100),
  taxRatePercent: z.number().min(0).max(28),
  whatsappRestaurant: z.string().trim().regex(/^\d{10,15}$/),
  whatsappKitchen: z.string().trim().regex(/^\d{10,15}$/),
});

export const discountSchema = z.object({
  discountPaise: z.number().int().min(0).max(10000000),
  reason: z.string().trim().min(3).max(200),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(5).max(120),
  razorpay_payment_id: z.string().trim().min(5).max(120),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i),
});

export const simulatedPaymentSchema = z.object({
  tableToken: tableTokenSchema,
});

export const refundSchema = z.object({
  amountPaise: z.number().int().min(1),
  reason: z.string().trim().min(3).max(200),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
