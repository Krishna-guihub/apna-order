import { config } from '../config.js';
import { findUserById, verifySession } from '../services/authService.js';
import { unauthorized, forbidden } from '../utils/errors.js';

export function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[config.cookieName];
    if (!token) throw unauthorized();

    const payload = verifySession(token);
    const user = findUserById(Number(payload.sub));
    if (!user || !user.is_active) {
      throw unauthorized('Your account is inactive or no longer exists.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Your session has expired. Please sign in again.'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(unauthorized('Invalid session. Please sign in again.'));
    }
    next(error);
  }
}

export function optionalAuthenticate(req, _res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = verifySession(token);
    const user = findUserById(Number(payload.sub));
    req.user = user && user.is_active ? user : null;
    next();
  } catch {
    req.user = null;
    next();
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('This action requires a different staff role.'));
    }
    next();
  };
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') {
    return next(forbidden('Administrator access is required.'));
  }
  next();
}
