import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const makeLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max: config.isTest ? 10000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message,
      },
    },
  });

export const generalLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: 'Too many requests. Please wait a moment and try again.',
});

export const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sign-in attempts. Please try again in 15 minutes.',
});

export const orderLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many order attempts. Please wait before trying again.',
});

export const paymentLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many payment attempts. Please wait before trying again.',
});

export const webhookLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 240,
  message: 'Too many webhook deliveries.',
});
