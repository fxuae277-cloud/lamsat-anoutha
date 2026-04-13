-- Migration 0017: إضافة variant_id لجدول order_items
-- يربط كل بند طلب بالـ variant المحدد (لون + مقاس) مباشرةً

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

-- فهرس لتسريع الاستعلامات بالـ variant
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
