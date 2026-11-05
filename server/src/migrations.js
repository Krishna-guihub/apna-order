export const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_number INTEGER NOT NULL UNIQUE CHECK (table_number > 0),
        label TEXT NOT NULL DEFAULT '',
        qr_token TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
        category TEXT NOT NULL,
        is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
        image_url TEXT NOT NULL DEFAULT '',
        is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        prep_minutes INTEGER NOT NULL DEFAULT 15 CHECK (prep_minutes BETWEEN 1 AND 180),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL UNIQUE,
        table_id INTEGER NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        status TEXT NOT NULL DEFAULT 'PLACED'
          CHECK (status IN ('PLACED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')),
        payment_status TEXT NOT NULL DEFAULT 'UNPAID'
          CHECK (payment_status IN ('UNPAID', 'PAYMENT_PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')),
        notes TEXT NOT NULL DEFAULT '',
        subtotal_paise INTEGER NOT NULL CHECK (subtotal_paise >= 0),
        tax_rate_bps INTEGER NOT NULL CHECK (tax_rate_bps >= 0),
        tax_paise INTEGER NOT NULL CHECK (tax_paise >= 0),
        discount_paise INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
        total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
        discount_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        served_at TEXT,
        cancelled_at TEXT
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
        item_name TEXT NOT NULL,
        unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
        quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 50),
        line_total_paise INTEGER NOT NULL CHECK (line_total_paise >= 0),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'simulated')),
        provider_order_id TEXT UNIQUE,
        provider_payment_id TEXT UNIQUE,
        provider_signature TEXT,
        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'CREATED'
          CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED')),
        is_simulated INTEGER NOT NULL DEFAULT 0 CHECK (is_simulated IN (0, 1)),
        signature_verified INTEGER NOT NULL DEFAULT 0 CHECK (signature_verified IN (0, 1)),
        verified_via TEXT CHECK (verified_via IN ('checkout_signature', 'webhook', 'reconciliation', 'simulation')),
        method TEXT,
        failure_reason TEXT,
        raw_response_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        paid_at TEXT
      );

      CREATE TABLE IF NOT EXISTS refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
        provider_refund_id TEXT UNIQUE,
        request_key TEXT NOT NULL,
        amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
        initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        raw_response_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (payment_id, request_key)
      );

      CREATE TABLE IF NOT EXISTS payment_webhook_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        signature_verified INTEGER NOT NULL DEFAULT 0 CHECK (signature_verified IN (0, 1)),
        processed INTEGER NOT NULL DEFAULT 0 CHECK (processed IN (0, 1)),
        payload_json TEXT NOT NULL DEFAULT '{}',
        error_message TEXT,
        received_at TEXT NOT NULL,
        processed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ip_address TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_orders_table_created
        ON orders(table_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_status_created
        ON orders(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status
        ON orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_order_items_order
        ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_status_created
        ON payments(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_refunds_payment
        ON refunds(payment_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created
        ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_menu_category_available
        ON menu_items(category, is_available, is_archived);
    `,
  },
];
