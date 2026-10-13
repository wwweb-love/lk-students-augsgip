const config = require('../config')

function buildResetEmail(email, link) {
  const subject = 'Сброс пароля — Личный кабинет студента'
  const text = [
    'Здравствуйте!',
    '',
    'Вы запросили сброс пароля в личном кабинете студента.',
    '',
    `Ссылка для смены пароля: ${link}`,
    '',
    'Ссылка действительна 5 минут. Пароль изменится только после того,',
    'как вы откроете ссылку и укажете новый пароль.',
    '',
    'Если это были не вы — просто проигнорируйте это письмо.',
  ].join('\n')

  return { subject, text }
}

/**
 * Отправляет письмо со ссылкой для сброса пароля.
 * Если SMTP не настроен (DEV-режим) — печатает письмо в консоль.
 */
async function sendPasswordResetLink(email, link) {
  const { subject, text } = buildResetEmail(email, link)

  if (!config.smtp.host) {
    console.log(`\n📧 [DEV-режим, SMTP не настроен] Кому: ${email}\nТема: ${subject}\n${text}\n`)
    return { delivered: false, dev: true }
  }

  // Ленивый require — nodemailer нужен только при настроенном SMTP
  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject,
    text,
  })
  return { delivered: true, dev: false }
}

module.exports = { sendPasswordResetLink }
