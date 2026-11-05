import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(currentDir, '../..');

const envFile = process.env.ENV_FILE
  ? path.resolve(ROOT_DIR, process.env.ENV_FILE)
  : path.join(ROOT_DIR, '.env');

dotenv.config({ path: envFile });

function toBool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalisePhone(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';
const paymentMode = (process.env.PAYMENT_MODE || 'simulated').toLowerCase();
const jwtSecret =
  process.env.JWT_SECRET || (isProduction ? '' : 'apna-order-local-development-secret-change-me');

if (!['simulated', 'razorpay'].includes(paymentMode)) {
  throw new Error('PAYMENT_MODE must be either "simulated" or "razorpay".');
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

if (isProduction && jwtSecret.includes('replace-with')) {
  throw new Error('Refusing to start in production with the placeholder JWT_SECRET.');
}

if (isProduction && paymentMode === 'simulated') {
  throw new Error('Simulated payments are disabled in production. Configure Razorpay.');
}

if (paymentMode === 'razorpay') {
  if (!process.env.RAZORPAY_KEY_ID?.startsWith('rzp_')) {
    throw new Error('PAYMENT_MODE=razorpay requires a valid RAZORPAY_KEY_ID.');
  }
  if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('replace-with')) {
    throw new Error('PAYMENT_MODE=razorpay requires RAZORPAY_KEY_SECRET.');
  }
  if (
    !process.env.RAZORPAY_WEBHOOK_SECRET ||
    process.env.RAZORPAY_WEBHOOK_SECRET.includes('replace-with')
  ) {
    throw new Error('PAYMENT_MODE=razorpay requires RAZORPAY_WEBHOOK_SECRET.');
  }
}

const databasePathSetting = process.env.DATABASE_PATH || 'server/data/apna-order.sqlite';
const databasePath =
  databasePathSetting === ':memory:'
    ? ':memory:'
    : path.isAbsolute(databasePathSetting)
      ? databasePathSetting
      : path.resolve(ROOT_DIR, databasePathSetting);

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOrigins = (process.env.CORS_ORIGINS || frontendUrl)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = Object.freeze({
  env: environment,
  isProduction,
  isTest: environment === 'test',
  port: toInt(process.env.PORT, 4000),
  appName: process.env.APP_NAME || 'Apna Order',
  rootDir: ROOT_DIR,
  envFile,
  databasePath,
  frontendUrl,
  frontendPublicUrl: (process.env.FRONTEND_PUBLIC_URL || frontendUrl).replace(/\/$/, ''),
  corsOrigins,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieName: process.env.COOKIE_NAME || 'apna_order_session',
  cookieSecure: toBool(process.env.COOKIE_SECURE, isProduction),
  seedDemoData: !isProduction && toBool(process.env.SEED_DEMO_DATA, true),
  enableDevTools: !isProduction && toBool(process.env.ENABLE_DEV_TOOLS, true),
  paymentMode,
  defaultTaxRateBps: Math.max(0, toInt(process.env.DEFAULT_TAX_RATE_BPS, 500)),
  trustProxy: toBool(process.env.TRUST_PROXY, false),
  reconcileMinutes: Math.max(1, toInt(process.env.PAYMENT_RECONCILE_MINUTES, 10)),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  whatsapp: {
    restaurantNumber: normalisePhone(process.env.WHATSAPP_RESTAURANT_NUMBER || '919244177036'),
    kitchenNumber: normalisePhone(process.env.WHATSAPP_KITCHEN_NUMBER || '919244177036'),
  },
  seed: {
    adminEmail: (process.env.SEED_ADMIN_EMAIL || 'admin@apnaorder.local').toLowerCase(),
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    staffEmail: (process.env.SEED_STAFF_EMAIL || 'kitchen@apnaorder.local').toLowerCase(),
    staffPassword: process.env.SEED_STAFF_PASSWORD || 'Kitchen@12345',
  },
});

if (config.isProduction && !config.cookieSecure) {
  console.warn('WARNING: COOKIE_SECURE=false in production. Set COOKIE_SECURE=true behind HTTPS.');
}
