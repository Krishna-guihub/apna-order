import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { db } from './db.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { paymentRouter } from './routes/payments.js';
import { staffRouter } from './routes/staff.js';
import { adminRouter } from './routes/admin.js';
import { webhook } from './controllers/paymentController.js';
import { asyncHandler } from './utils/asyncHandler.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter, webhookLimiter } from './middleware/rateLimiters.js';
import { sameOriginGuard } from './middleware/sameOrigin.js';
import { AppError } from './utils/errors.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy ? 1 : false);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(
        new AppError(403, 'CORS_REJECTED', 'This browser origin is not allowed by the API.'),
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key'],
    maxAge: 86400,
  }),
);
app.use(cookieParser());

// Razorpay signs the exact raw request body. This route must be registered before express.json().
app.post(
  '/api/payments/webhook',
  webhookLimiter,
  express.raw({ type: 'application/json', limit: '256kb' }),
  asyncHandler(webhook),
);

app.use('/api', generalLimiter, sameOriginGuard);
app.use(express.json({ limit: '128kb' }));

app.get('/api/health', (_req, res) => {
  const dbCheck = db.prepare('SELECT 1 AS ok').get();
  res.json({
    ok: dbCheck.ok === 1,
    app: config.appName,
    environment: config.env,
    paymentMode: config.paymentMode,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/staff', staffRouter);
app.use('/api/admin', adminRouter);
app.use('/api', notFoundHandler);

const clientDist = path.resolve(config.rootDir, 'client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(
    express.static(clientDist, {
      index: false,
      maxAge: config.isProduction ? '1h' : 0,
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);
