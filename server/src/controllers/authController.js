import { config } from '../config.js';
import { db, nowIso } from '../db.js';
import { AppError } from '../utils/errors.js';
import {
  cookieOptions,
  findUserByEmail,
  publicUser,
  signSession,
  verifyPassword,
} from '../services/authService.js';
import { logAudit } from '../services/auditService.js';

export function login(req, res) {
  const { email, password } = req.validated.body;
  const user = findUserByEmail(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    logAudit({
      actorRole: 'anonymous',
      action: 'LOGIN_FAILED',
      entityType: 'user',
      entityId: null,
      metadata: { email: email.toLowerCase() },
      ipAddress: req.ip,
    });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }

  if (!user.is_active) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This staff account is disabled.');
  }

  const token = signSession(user);
  res.cookie(config.cookieName, token, cookieOptions());
  logAudit({
    userId: user.id,
    actorRole: user.role,
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    metadata: { email: user.email },
    ipAddress: req.ip,
  });

  res.json({ user: publicUser(user) });
}

export function me(req, res) {
  res.json({ user: req.user ? publicUser(req.user) : null });
}

export function logout(req, res) {
  res.clearCookie(config.cookieName, { path: '/' });
  if (req.user) {
    logAudit({
      userId: req.user.id,
      actorRole: req.user.role,
      action: 'LOGOUT',
      entityType: 'user',
      entityId: req.user.id,
      ipAddress: req.ip,
    });
  }
  res.status(204).send();
}

export function authHealth(_req, res) {
  const row = db.prepare('SELECT 1 AS ok').get();
  res.json({ ok: row.ok === 1, time: nowIso() });
}
