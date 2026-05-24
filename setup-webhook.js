#!/usr/bin/env node
// ============================================================
// سكريبت إعداد Webhook على تيليجرام
// شغّله مرة واحدة بعد النشر على Vercel
// الاستخدام: node setup-webhook.js
// ============================================================

const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL; // مثال: https://your-app.vercel.app

if (!BOT_TOKEN || !VERCEL_URL) {
  console.error('❌ يرجى تعيين BOT_TOKEN و VERCEL_URL كمتغيرات بيئة');
  process.exit(1);
}

const webhookUrl = `${VERCEL_URL}/api`;

fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl }),
})
  .then((res) => res.json())
  .then((data) => {
    if (data.ok) {
      console.log(`✅ تم تعيين Webhook بنجاح على: ${webhookUrl}`);
    } else {
      console.error('❌ فشل تعيين Webhook:', data.description);
    }
  })
  .catch((err) => console.error('❌ خطأ في الاتصال:', err));
