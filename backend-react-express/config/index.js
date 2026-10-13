require('dotenv').config()

// Единая точка доступа к настройкам приложения (все значения — из .env)
module.exports = {
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,

  // Базовый адрес фронтенда — для ссылок в письмах
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // SMTP (если не задан — письма логируются в консоль, DEV-режим)
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: String(process.env.SMTP_SECURE ?? 'true') === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
  },

  // TTL ссылки для сброса пароля
  passwordResetTtlMs: 5 * 60 * 1000, // 5 минут

  // Secure-флаг cookie: включать при переходе на HTTPS (COOKIE_SECURE=true)
  cookieSecure: String(process.env.COOKIE_SECURE ?? 'false') === 'true',
}
