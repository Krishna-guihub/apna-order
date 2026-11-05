import { AppError } from '../utils/errors.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found.`));
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
  }

  const message = String(error?.message || '');
  if (message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_RECORD',
        message: 'That record already exists.',
      },
    });
  }

  if (message.includes('FOREIGN KEY constraint failed')) {
    return res.status(409).json({
      error: {
        code: 'RECORD_IN_USE',
        message: 'This record is linked to existing data and cannot be changed that way.',
      },
    });
  }

  console.error(`[api] ${req.method} ${req.originalUrl} failed:`, error);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    },
  });
}
