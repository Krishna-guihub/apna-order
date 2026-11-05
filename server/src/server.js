import { app } from './app.js';
import { config } from './config.js';
import { closeDatabase, db } from './db.js';
import { seedDatabase } from './seed.js';
import { startReconciliationJob } from './services/paymentService.js';

if (config.seedDemoData) {
  const menuCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items').get().count;
  if (menuCount === 0) {
    console.log('[startup] Empty demo database detected; creating demo data.');
    seedDatabase({ silent: true });
  }
}

const server = app.listen(config.port, () => {
  console.log('');
  console.log(`  ${config.appName} API`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Local API:     http://localhost:${config.port}/api`);
  console.log(`  Health check:  http://localhost:${config.port}/api/health`);
  console.log(`  Payment mode:  ${config.paymentMode.toUpperCase()}`);
  console.log(`  Environment:   ${config.env}`);
  console.log(`  Database:      ${config.databasePath}`);
  if (config.paymentMode === 'simulated') {
    console.log('  Payments are simulated in development. No money moves.');
  }
  console.log('');
});

const reconciliationJob = startReconciliationJob();
if (reconciliationJob) {
  console.log(`[payments] Reconciliation job runs every ${config.reconcileMinutes} minutes.`);
}

function shutdown(signal) {
  console.log(`\n[server] ${signal} received. Shutting down...`);
  if (reconciliationJob) clearInterval(reconciliationJob);
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
  setTimeout(() => {
    closeDatabase();
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
