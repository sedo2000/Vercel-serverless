// ============================================================
// بوت تيليجرام لتحميل فيديوهات تيك توك
// مبني بـ Telegraf + yt-dlp-exec + Vercel Serverless
// ============================================================

const { Telegraf, Markup } = require('telegraf');
const ytDlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── المتغيرات البيئية ───────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const CHANNEL_ID = process.env.CHANNEL_ID; // مثال: @mychannel أو -100xxxxxxxxx

// ─── حالة البوت في الذاكرة ───────────────────────────────────
const botState = {
  users: new Set(),           // مجموعة IDs المستخدمين
  startTime: Date.now(),      // وقت بدء تشغيل البوت
  broadcastMode: new Set(),   // المشرفون في وضع الإذاعة
};

// ─── إنشاء البوت ─────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);
const { Telegraf } = require('telegraf');
const ytDl = require('yt-dlp-exec');

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- كود الويب هوك التلقائي ---
const setWebhook = async () => {
    const webhookUrl = `${process.env.VERCEL_URL}/api`;
    try {
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`✅ تم ضبط الويب هوك تلقائياً على: ${webhookUrl}`);
    } catch (e) {
        console.error('❌ فشل ضبط الويب هوك تلقائياً:', e);
    }
};

// تشغيل الويب هوك عند بدء البوت
setWebhook();
// -----------------------------

// بقية كود البوت الخاص بك هنا...

// ============================================================
// دالة: التحقق من اشتراك المستخدم في القناة
// ============================================================
async function isSubscribed(ctx) {
  if (!CHANNEL_ID) return true; // إذا لم تُحدد قناة، تجاوز التحقق
  try {
    const member = await ctx.telegram.getChatMember(CHANNEL_ID, ctx.from.id);
    return ['member', 'administrator', 'creator'].includes(member.status);
  } catch {
    return false; // في حال خطأ (القناة غير موجودة مثلاً)، اسمح بالمرور
  }
}

// ─── رسالة الاشتراك الإلزامي ─────────────────────────────────
function subscribeMessage(ctx) {
  return ctx.reply(
    `🔒 *يجب الاشتراك في قناتنا أولاً للاستخدام*\n\n` +
    `اشترك ثم أرسل /start مجدداً أو أعد إرسال الرابط.`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 اشترك في القناة', `https://t.me/${CHANNEL_ID.replace('@', '')}`)],
        [Markup.button.callback('✅ تحققت من اشتراكي', 'check_sub')],
      ]),
    }
  );
}

// ─── Middleware: تسجيل المستخدمين ────────────────────────────
bot.use((ctx, next) => {
  if (ctx.from) {
    botState.users.add(ctx.from.id); // تسجيل كل مستخدم يتفاعل مع البوت
  }
  return next();
});

// ============================================================
// أمر /start — رسالة الترحيب
// ============================================================
bot.start(async (ctx) => {
  const subscribed = await isSubscribed(ctx);
  if (!subscribed) return subscribeMessage(ctx);

  const name = ctx.from.first_name || 'صديقي';
  await ctx.reply(
    `👋 *أهلاً ${name}!*\n\n` +
    `أنا بوت تحميل فيديوهات *تيك توك* 🎵\n\n` +
    `📌 *كيفية الاستخدام:*\n` +
    `فقط أرسل لي رابط أي فيديو تيك توك وسأحمله لك فوراً بدون علامة مائية!\n\n` +
    `_مثال:_ \`https://www.tiktok.com/@user/video/123\``,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📢 قناة المطور', 'https://t.me/yourchannel')],
        [Markup.button.callback('📖 تعليمات الاستخدام', 'show_help')],
      ]),
    }
  );
});

// ============================================================
// زر: تعليمات الاستخدام
// ============================================================
bot.action('show_help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `📖 *تعليمات الاستخدام:*\n\n` +
    `1️⃣ افتح تطبيق تيك توك\n` +
    `2️⃣ اختر الفيديو الذي تريده\n` +
    `3️⃣ اضغط *مشاركة* ثم *نسخ الرابط*\n` +
    `4️⃣ الصق الرابط هنا وسيتم التحميل تلقائياً ✅\n\n` +
    `⚠️ *ملاحظة:* الفيديوهات الخاصة لا يمكن تحميلها.`,
    { parse_mode: 'Markdown' }
  );
});

// ============================================================
// زر: التحقق من الاشتراك
// ============================================================
bot.action('check_sub', async (ctx) => {
  await ctx.answerCbQuery('⏳ جارٍ التحقق...');
  const subscribed = await isSubscribed(ctx);
  if (subscribed) {
    await ctx.editMessageText(
      `✅ *تم التحقق بنجاح!*\nأرسل رابط تيك توك الآن 🎉`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.answerCbQuery('❌ لم يتم الاشتراك بعد!', { show_alert: true });
  }
});

// ============================================================
// لوحة تحكم المشرف /admin
// ============================================================
bot.command('admin', async (ctx) => {
  // منع غير المشرفين
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('🚫 *ليس لديك صلاحية لهذا الأمر.*', { parse_mode: 'Markdown' });
  }

  await ctx.reply(
    `🛠 *لوحة تحكم المطور*\n\nمرحباً بك يا مشرف! اختر من القائمة:`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 الإحصائيات', 'admin_stats')],
        [Markup.button.callback('📢 إذاعة رسالة', 'admin_broadcast')],
        [Markup.button.callback('⚙️ حالة النظام', 'admin_system')],
      ]),
    }
  );
});

// ─── زر: الإحصائيات ──────────────────────────────────────────
bot.action('admin_stats', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('🚫 غير مصرح!');
  await ctx.answerCbQuery();
  await ctx.reply(
    `📊 *إحصائيات البوت:*\n\n` +
    `👤 إجمالي المستخدمين: *${botState.users.size}*\n` +
    `🕐 وقت التشغيل: *${getUptime()}*`,
    { parse_mode: 'Markdown' }
  );
});

// ─── زر: حالة النظام ─────────────────────────────────────────
bot.action('admin_system', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('🚫 غير مصرح!');
  await ctx.answerCbQuery();
  const memUsage = process.memoryUsage();
  await ctx.reply(
    `⚙️ *حالة النظام:*\n\n` +
    `🟢 البوت يعمل بشكل طبيعي\n` +
    `⏱ وقت التشغيل: *${getUptime()}*\n` +
    `💾 الذاكرة المستخدمة: *${Math.round(memUsage.rss / 1024 / 1024)} MB*\n` +
    `🖥 النظام: *${os.platform()} - ${os.arch()}*`,
    { parse_mode: 'Markdown' }
  );
});

// ─── زر: وضع الإذاعة ─────────────────────────────────────────
bot.action('admin_broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('🚫 غير مصرح!');
  await ctx.answerCbQuery();
  botState.broadcastMode.add(ADMIN_ID); // تفعيل وضع الإذاعة
  await ctx.reply(
    `📢 *وضع الإذاعة مفعّل!*\n\n` +
    `اكتب الآن الرسالة التي تريد إرسالها لجميع المستخدمين.\n` +
    `أرسل /cancel للإلغاء.`,
    { parse_mode: 'Markdown' }
  );
});

// ─── أمر إلغاء الإذاعة ───────────────────────────────────────
bot.command('cancel', async (ctx) => {
  if (ctx.from.id === ADMIN_ID && botState.broadcastMode.has(ADMIN_ID)) {
    botState.broadcastMode.delete(ADMIN_ID);
    await ctx.reply('✅ تم إلغاء وضع الإذاعة.', { parse_mode: 'Markdown' });
  }
});

// ============================================================
// معالجة الرسائل النصية (روابط تيك توك + إذاعة المشرف)
// ============================================================
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  // ─── تنفيذ الإذاعة إذا كان المشرف في وضع الإذاعة ───────────
  if (ctx.from.id === ADMIN_ID && botState.broadcastMode.has(ADMIN_ID)) {
    botState.broadcastMode.delete(ADMIN_ID);
    let successCount = 0;
    let failCount = 0;

    const statusMsg = await ctx.reply(`📤 جارٍ الإرسال لـ *${botState.users.size}* مستخدم...`, {
      parse_mode: 'Markdown',
    });

    // إرسال الرسالة لكل المستخدمين
    for (const userId of botState.users) {
      try {
        await ctx.telegram.sendMessage(userId, `📢 *رسالة من المطور:*\n\n${text}`, {
          parse_mode: 'Markdown',
        });
        successCount++;
      } catch {
        failCount++; // المستخدم ربما حجب البوت
      }
    }

    return ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✅ *اكتملت الإذاعة!*\n\n📨 نجح: *${successCount}*\n❌ فشل: *${failCount}*`,
      { parse_mode: 'Markdown' }
    );
  }

  // ─── التحقق من الاشتراك قبل تحميل الفيديو ──────────────────
  const subscribed = await isSubscribed(ctx);
  if (!subscribed) return subscribeMessage(ctx);

  // ─── التحقق من أن الرابط من تيك توك ─────────────────────────
  const isTikTok = /tiktok\.com/i.test(text);
  if (!isTikTok) {
    return ctx.reply(
      `❌ *رابط غير صالح!*\n\nيرجى إرسال رابط من موقع تيك توك فقط.\n` +
      `_مثال:_ \`https://www.tiktok.com/@user/video/123\``,
      { parse_mode: 'Markdown' }
    );
  }

  // ─── بدء عملية التحميل ───────────────────────────────────────
  const loadingMsg = await ctx.reply('⏳ *جارٍ التحليل والتحميل...*', {
    parse_mode: 'Markdown',
  });

  // مسار مؤقت لحفظ الفيديو
  const tempFile = path.join(os.tmpdir(), `tiktok_${Date.now()}.mp4`);

  try {
    // ─── استخراج معلومات الفيديو باستخدام yt-dlp ─────────────
    const info = await ytDlp(text, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      preferFreeFormats: true,
    });

    const title = info.title || 'بدون عنوان';
    const uploader = info.uploader || info.creator || 'غير معروف';

    // ─── تحميل الفيديو بأفضل جودة ────────────────────────────
    await ytDlp(text, {
      output: tempFile,
      format: 'mp4/bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
      noWarnings: true,
    });

    // ─── إرسال الفيديو للمستخدم ──────────────────────────────
    await ctx.replyWithVideo(
      { source: tempFile },
      {
        caption:
          `🎬 *${title}*\n\n` +
          `👤 *الحساب:* @${uploader}\n` +
          `🔗 *الرابط:* ${text}`,
        parse_mode: 'Markdown',
      }
    );

    // ─── حذف رسالة التحميل ───────────────────────────────────
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

  } catch (err) {
    // ─── معالجة الأخطاء بذكاء ────────────────────────────────
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    let errorMsg = '⚠️ *حدث خطأ غير متوقع.* حاول مرة أخرى لاحقاً.';

    if (/private/i.test(err.message)) {
      errorMsg = '🔒 *الفيديو خاص!* لا يمكن تحميل الفيديوهات الخاصة.';
    } else if (/not found|does not exist/i.test(err.message)) {
      errorMsg = '🗑 *الفيديو محذوف أو غير موجود!*';
    } else if (/copyright/i.test(err.message)) {
      errorMsg = '⛔ *الفيديو محجوب بسبب حقوق الملكية.*';
    } else if (/rate limit/i.test(err.message)) {
      errorMsg = '⏱ *طلبات كثيرة!* انتظر قليلاً ثم حاول مجدداً.';
    } else if (/network|timeout/i.test(err.message)) {
      errorMsg = '🌐 *خطأ في الاتصال.* تحقق من الرابط وحاول مجدداً.';
    }

    await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
  } finally {
    // ─── حذف الملف المؤقت دائماً بعد الانتهاء ───────────────
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
});

// ============================================================
// دالة مساعدة: حساب وقت تشغيل البوت
// ============================================================
function getUptime() {
  const ms = Date.now() - botState.startTime;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);
  return `${hours}س ${minutes}د ${seconds}ث`;
}

// ============================================================
// معالجة الأخطاء العامة — منع انهيار البوت
// ============================================================
bot.catch((err, ctx) => {
  console.error('خطأ في البوت:', err);
  if (ctx) {
    ctx.reply('⚠️ حدث خطأ تقني مؤقت. يرجى المحاولة مجدداً.').catch(() => {});
  }
});

// ============================================================
// Vercel Serverless Handler
// ============================================================
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      // معالجة webhook القادم من تيليجرام
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else {
      // صفحة بسيطة للتحقق من أن الـ endpoint يعمل
      res.status(200).send('🤖 Bot is running!');
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
