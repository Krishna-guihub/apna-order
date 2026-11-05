import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db, nowIso } from '../db.js';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function signSession(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      email: user.email,
      name: user.name,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      issuer: 'apna-order',
      audience: 'apna-order-web',
    },
  );
}

export function verifySession(token) {
  return jwt.verify(token, config.jwtSecret, {
    issuer: 'apna-order',
    audience: 'apna-order-web',
  });
}

export function findUserByEmail(email) {
  return db
    .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
    .get(String(email).trim().toLowerCase());
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.is_active),
    createdAt: user.created_at,
  };
}

export function setUserPassword(id, password) {
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    hashPassword(password),
    nowIso(),
    id,
  );
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
}
