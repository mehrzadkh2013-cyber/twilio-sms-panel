require("dotenv").config();

const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");
const twilio = require("twilio");

const app = express();
const port = Number(process.env.PORT || 3000);

const required = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"];
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`Missing environment variable: ${key}`);
  }
}

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تعداد ارسال‌ها موقتاً محدود شده است." }
});

function validE164(phone) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function validCode(code) {
  return /^\d{4,8}$/.test(code);
}

app.post("/api/send-code", sendLimiter, async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const code = String(req.body.code || "").trim();

    if (!validE164(phone)) {
      return res.status(400).json({
        error: "شماره را با قالب بین‌المللی E.164 وارد کنید؛ مثل +989121234567."
      });
    }

    if (!validCode(code)) {
      return res.status(400).json({
        error: "کد باید فقط شامل ۴ تا ۸ رقم باشد."
      });
    }

    if (!client || !process.env.TWILIO_FROM) {
      return res.status(503).json({
        error: "تنظیمات سرویس SMS روی سرور کامل نشده است."
      });
    }

    const message = await client.messages.create({
      body: `کد شما: ${code}`,
      from: process.env.TWILIO_FROM,
      to: phone
    });

    res.json({
      ok: true,
      messageSid: message.sid,
      status: message.status
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({
      error: "ارسال پیامک انجام نشد. تنظیمات حساب و شماره فرستنده را بررسی کنید."
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`SMS app running at http://localhost:${port}`);
});
