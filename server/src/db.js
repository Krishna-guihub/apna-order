import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import { migrations } from './migrations.js';

function ensureDatabaseDirectory(filePath) {
  if (filePath === ':memory:') return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

ensureDatabaseDirectory(config.databasePath);

export const db = new DatabaseSync(config.databasePath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');
if (config.databasePath !== ':memory:') {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((row) => row.version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(migration.sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(migration.version, migration.name, new Date().toISOString());
      db.exec('COMMIT');
      console.log(`[db] Applied migration ${migration.version}: ${migration.name}`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function transaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // The transaction may already have been rolled back by SQLite.
    }
    throw error;
  }
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value, updatedAt = nowIso()) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value), updatedAt);
}

export function getNumericSetting(key, fallback = 0) {
  const value = Number.parseFloat(getSetting(key, ''));
  return Number.isFinite(value) ? value : fallback;
}

export function initializeDatabase() {
  runMigrations();
  const timestamp = nowIso();
  const defaults = {
    restaurant_name: config.appName,
    tax_rate_bps: String(config.defaultTaxRateBps),
    whatsapp_restaurant_number: config.whatsapp.restaurantNumber,
    whatsapp_kitchen_number: config.whatsapp.kitchenNumber,
  };
  const insert = db.prepare(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING',
  );
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value, timestamp);
  }
  return db;
}

export function closeDatabase() {
  try {
    db.close();
  } catch {
    // Already closed.
  }
}

initializeDatabase();
