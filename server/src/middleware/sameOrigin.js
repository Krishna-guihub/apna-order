import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOriginGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (!origin) return next();

  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  const allowed = config.corsOrigins.includes(origin) || origin === requestOrigin;

  if (!allowed) {
    return next(
      new AppError(403, 'ORIGIN_REJECTED', 'This request origin is not allowed to change data.'),
    );
  }
  next();
}
