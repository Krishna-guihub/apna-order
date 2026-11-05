import fs from 'node:fs';
import { config } from './config.js';
import { closeDatabase } from './db.js';
import { seedDatabase } from './seed.js';

if (config.isProduction) {
  console.error('Refusing to reset a production database.');
  process.exit(1);
}

closeDatabase();
for (const suffix of ['', '-shm', '-wal']) {
  const file = `${config.databasePath}${suffix}`;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`[reset] Removed ${file}`);
  }
}

const { initializeDatabase } = await import('./db.js');
initializeDatabase();
seedDatabase();
closeDatabase();
console.log('[reset] Database recreated and seeded.');
