-- ═══════════════════════════════════════════════════════════════════
-- Migration 0005: Professional POS Schema additions
-- Date: 2026-03-30
-- Strategy: ADD COLUMN only — no DROP, no data deletion
-- All new columns carry safe defaults; existing rows are unchanged
-- ═══════════════════════════════════════════════════════════════════

-- ── products: product_type, unit_of_measure, min_price, is_composite ──────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type      TEXT          NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS unit_of_measure   TEXT          NOT NULL DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS min_price         DECIMAL(10,3)          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_composite      BOOLEAN       NOT NULL DEFAULT false;

-- ── product_variants: is_default, weight, image_url ──────────────────────────
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS is_default        BOOLEAN       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weight            DECIMAL(8,3),
  ADD COLUMN IF NOT EXISTS image_url         TEXT;

-- ── purchase_items: add FK on variant_id (orphan count verified = 0) ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_purchase_items_variant'
      AND table_name = 'purchase_items'
  ) THEN
    ALTER TABLE purchase_items
      ADD CONSTRAINT fk_purchase_items_variant
      FOREIGN KEY (variant_id) REFERENCES product_variants(id);
  END IF;
END;
$$;

-- ── categories: optional parent hierarchy + sort order ───────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS parent_id         INTEGER       REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS sort_order        INTEGER       DEFAULT 0;

-- ── NEW TABLE: product_composite_items (bundles / kits) ──────────────────────
CREATE TABLE IF NOT EXISTS product_composite_items (
  id              INTEGER      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  parent_id       INTEGER      NOT NULL REFERENCES products(id),
  component_id    INTEGER      NOT NULL REFERENCES products(id),
  qty             DECIMAL(10,3) NOT NULL DEFAULT 1,
  UNIQUE (parent_id, component_id)
);

-- ── NEW TABLE: price_lists ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_lists (
  id              INTEGER      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name            TEXT         NOT NULL UNIQUE,
  description     TEXT,
  active          BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMP    DEFAULT NOW()
);

-- ── NEW TABLE: price_list_items ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_list_items (
  id              INTEGER       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  price_list_id   INTEGER       NOT NULL REFERENCES price_lists(id),
  product_id      INTEGER       NOT NULL REFERENCES products(id),
  variant_id      INTEGER       REFERENCES product_variants(id),
  override_price  DECIMAL(10,3) NOT NULL,
  UNIQUE (price_list_id, product_id, variant_id)
);

-- ── NEW TABLE: discount_rules ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_rules (
  id              INTEGER       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name            TEXT          NOT NULL,
  type            TEXT          NOT NULL DEFAULT 'percentage',
  value           DECIMAL(10,3) NOT NULL,
  applies_to      TEXT          NOT NULL DEFAULT 'all',
  category_id     INTEGER       REFERENCES categories(id),
  product_id      INTEGER       REFERENCES products(id),
  min_qty         INTEGER       DEFAULT 1,
  min_amount      DECIMAL(10,3) DEFAULT 0,
  starts_at       TIMESTAMP,
  ends_at         TIMESTAMP,
  active          BOOLEAN       NOT NULL DEFAULT true,
  created_at      TIMESTAMP     DEFAULT NOW()
);

-- ── Indexes for new columns ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_product_type
  ON products (product_type);

CREATE INDEX IF NOT EXISTS idx_products_is_composite
  ON products (is_composite) WHERE is_composite = true;

-- ── Indexes for new tables ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_composite_parent
  ON product_composite_items (parent_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_list_id
  ON price_list_items (price_list_id);

CREATE INDEX IF NOT EXISTS idx_price_list_items_product
  ON price_list_items (product_id);

CREATE INDEX IF NOT EXISTS idx_discount_rules_active
  ON discount_rules (active, starts_at, ends_at);
