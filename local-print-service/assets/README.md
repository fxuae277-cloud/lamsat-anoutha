# Lamsa Local Print Service — Assets

## Required files

- **`logo.png`** — اللوجو الرسمي لـ "لمسة أنوثة" (TOUCH OF FEMININITY).
  - أبعاد مفضلة: 240×120 px (يُحجَّم تلقائياً إلى ارتفاع 60 px في الملصق).
  - خلفية: شفافة أو بيضاء.
  - يتم تحميله من `tscLabel.ts` ودمجه في الـ SVG كـ base64.
  - إذا كان الملف مفقوداً، يستخدم الـ module placeholder text (لن يُسبب crash).

## Notes

- لا تضع ملفات حساسة أو مفاتيح هنا.
- المجلد يُحمَّل وقت تشغيل الخدمة فقط؛ لا يحتاج build خاص.
