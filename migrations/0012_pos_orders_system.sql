-- migration: 0012_pos_orders_system
-- Add POS invoice fields, extend orders, create held_invoices

-- ── Sales (invoices): add missing POS fields ──────────────────────────────
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid  DECIMAL(10,3) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_amount DECIMAL(10,3) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id);

-- ── Sale items: add variant fields ───────────────────────────────────────
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS size  TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS line_discount DECIMAL(10,3) DEFAULT 0;

-- ── Orders: extend for full order management ─────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id      INTEGER REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source           TEXT DEFAULT 'walk-in';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method  TEXT DEFAULT 'pickup';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee     DECIMAL(10,3) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal         DECIMAL(10,3) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount         DECIMAL(10,3) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type    TEXT DEFAULT 'value';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status   TEXT DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_id       INTEGER REFERENCES sales(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by       INTEGER REFERENCES users(id);

-- ── Order items: add variant fields ──────────────────────────────────────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size  TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,3) DEFAULT 0;

-- ── Held invoices ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS held_invoices (
  id            SERIAL PRIMARY KEY,
  hold_number   TEXT NOT NULL UNIQUE,
  items         JSONB NOT NULL DEFAULT '[]',
  customer_id   INTEGER REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  branch_id     INTEGER REFERENCES branches(id),
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW()
);
