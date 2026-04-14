-- Migration 0020: دعم رفع مرفقات متعددة لفواتير المشتريات
ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]'::jsonb;

-- نقل القيمة الموجودة في attachment_url إلى attachment_urls
UPDATE purchase_invoices
SET attachment_urls = jsonb_build_array(attachment_url)
WHERE attachment_url IS NOT NULL
  AND (attachment_urls IS NULL OR attachment_urls = '[]'::jsonb);
