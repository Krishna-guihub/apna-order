import QRCode from 'qrcode';
import { config } from '../config.js';
import { db, nowIso } from '../db.js';
import { generateTableToken } from '../utils/ids.js';
import { notFound } from '../utils/errors.js';

export function tableMenuUrl(token) {
  return `${config.frontendPublicUrl}/t/${token}`;
}

export function findTableByToken(token) {
  if (!token || typeof token !== 'string') return null;
  return db
    .prepare(`
      SELECT id, table_number, label, qr_token, is_active, created_at
      FROM restaurant_tables
      WHERE qr_token = ? AND is_active = 1
    `)
    .get(token);
}

export function requireTableByToken(token) {
  const table = findTableByToken(token);
  if (!table) {
    throw notFound('This table QR code is invalid or has been deactivated.');
  }
  return table;
}

export function createTable({ tableNumber, label = '' }) {
  const timestamp = nowIso();
  const token = generateTableToken();
  const result = db.prepare(`
    INSERT INTO restaurant_tables
      (table_number, label, qr_token, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(tableNumber, label, token, timestamp, timestamp);
  return db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(Number(result.lastInsertRowid));
}

export function listTables() {
  return db
    .prepare(`
      SELECT id, table_number, label, qr_token, is_active, created_at, updated_at
      FROM restaurant_tables
      ORDER BY table_number
    `)
    .all()
    .map((table) => ({
      ...table,
      menuUrl: tableMenuUrl(table.qr_token),
    }));
}

export function rotateTableToken(id) {
  const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id);
  if (!table) throw notFound('Table not found.');
  const token = generateTableToken();
  db.prepare('UPDATE restaurant_tables SET qr_token = ?, updated_at = ? WHERE id = ?').run(
    token,
    nowIso(),
    id,
  );
  return db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(id);
}

export async function tableQrDataUrl(table) {
  return QRCode.toDataURL(tableMenuUrl(table.qr_token), {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 560,
    color: {
      dark: '#153e2d',
      light: '#fffaf0',
    },
  });
}

export function getPublicTable(token) {
  const table = requireTableByToken(token);
  const restaurantName = db.prepare("SELECT value FROM app_settings WHERE key = 'restaurant_name'").get();
  return {
    id: table.id,
    tableNumber: table.table_number,
    label: table.label,
    restaurantName: restaurantName?.value || config.appName,
  };
}
