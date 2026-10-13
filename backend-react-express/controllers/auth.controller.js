const bcrypt = require('bcrypt')
const crypto = require('crypto')

const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const { generate, verify } = require('../utils/token')
const config = require('../config')
const { withTransaction } = require('../db/pool')
const studentModel = require('../models/student.model')
const passwordResetModel = require('../models/passwordReset.model')
const sessionModel = require('../models/session.model')
const mailer = require('../services/mailer')
const safeUser = require('../utils/safeUser')

// Cookie с токеном: httpOnly + SameSite=Strict (CSRF) + Secure по конфигу
function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/',
  })
}

// GET /api/auth/me — текущий пользователь (без хеша пароля)
const me = async (req, res) => {
  ok(res, safeUser(req.user))
}

// POST /api/auth/login — вход
const login = async (req, res) => {
  const { login: loginName, password } = req.body || {}

  if (typeof loginName !== 'string' || typeof password !== 'string' || !loginName || !password) {
    throw ApiError.badRequest('Введите логин и пароль')
  }
  if (loginName.length > 50) {
    throw ApiError.badRequest('Логин не длиннее 50 символов')
  }

  const user = await studentModel.findByLogin(loginName)
  if (!user) throw ApiError.unauthorized('Пользователь не найден')

  const isPasswordMatch = await bcrypt.compare(password, user.password)
  if (!isPasswordMatch) throw ApiError.unauthorized('Неверный пароль')

  const sid = crypto.randomBytes(16).toString('hex')
  const token = generate({ id: user.id, sid })
  setAuthCookie(res, token)
  await sessionModel.create({
    userId: user.id,
    sid,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  })
  ok(res, safeUser(user), { token })
}

// POST /api/auth/register — регистрация по СНИЛС из базы 1С
const register = async (req, res) => {
  const { snils, login: loginName, password, email } = req.body || {}

  if (
    typeof snils !== 'string' ||
    typeof loginName !== 'string' ||
    typeof password !== 'string' ||
    typeof email !== 'string' ||
    !snils || !loginName || !password || !email
  ) {
    throw ApiError.badRequest('Введите все данные')
  }
  if (loginName.length > 50) throw ApiError.badRequest('Логин не длиннее 50 символов')
  if (email.length > 150) throw ApiError.badRequest('Электронная почта не длиннее 150 символов')
  if (password.length > 72) throw ApiError.badRequest('Пароль не длиннее 72 символов')

  const hashedPassword = await bcrypt.hash(password, 10)

  const createdUser = await withTransaction(async (client) => {
    const snilsDigits = studentModel.normalizeSnils(snils)
    if (!snilsDigits) throw ApiError.badRequest('СНИЛС должен содержать 11 цифр')

    const candidate = await studentModel.findCandidateBySnils(snilsDigits, client)
    if (!candidate) throw ApiError.badRequest('Пользователь с таким СНИЛС не найден')

    if (candidate.login && candidate.password) {
      throw ApiError.badRequest('Пользователь уже зарегистрирован!')
    }

    // Уже есть учётная запись с этим СНИЛС (повторная регистрация)
    const existing = await studentModel.findBySnils(candidate.snils, client)
    if (existing) {
      throw ApiError.badRequest('Пользователь уже зарегистрирован!')
    }

    const taken = await studentModel.isLoginTaken(loginName, candidate.id, client)
    if (taken) throw ApiError.badRequest('Этот login уже используется другим пользователем')

    // Почта уникальна (ограничение students_email_key)
    const emailTaken = await studentModel.isEmailTaken(email, null, client)
    if (emailTaken) throw ApiError.badRequest('Эта почта уже используется другим пользователем')

    return studentModel.create(
      {
        name: candidate.name,
        specialty: candidate.specialty,
        group_name: candidate.group_name,
        login: loginName,
        password: hashedPassword,
        email,
        snils: studentModel.normalizeSnils(candidate.snils) || candidate.snils,
        role: 'Student', // по умолчанию каждому новому пользователю
      },
      client
    )
  })

  const sid = crypto.randomBytes(16).toString('hex')
  const token = generate({ id: createdUser.id, sid })
  setAuthCookie(res, token)
  await sessionModel.create({
    userId: createdUser.id,
    sid,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  })
  ok(res, safeUser(createdUser), { token })
}

// POST /api/auth/logout — выход
const logout = (req, res) => {
  // закрываем активную сессию (токен из cookie или заголовка, если валиден)
  try {
    const raw = req.cookies.token ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null)
    if (raw) {
      const data = verify(raw)
      if (data.sid) sessionModel.close(data.sid).catch(() => {})
    }
  } catch {
    // невалидный токен — закрывать нечего
  }

  res.cookie('token', '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.cookieSecure,
    path: '/',
    expires: new Date(0),
  })
  ok(res, null)
}

// Маскирует почту: rroman2115@yandex.ru → r****5@yandex.ru
function maskEmail(email) {
  if (!email || !email.includes('@')) return '***'
  const [name, domain] = email.split('@')
  const visible = name.length <= 2 ? name[0] || '*' : name[0] + '****' + name[name.length - 1]
  return `${visible}@${domain}`
}

// Создаёт одноразовую ссылку сброса (5 минут) и отправляет её на почту пользователя.
// Старые ссылки пользователя отзываются — активна только последняя.
async function issueResetLink(user) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + config.passwordResetTtlMs)

  await passwordResetModel.invalidateForUser(user.id)
  await passwordResetModel.create(user.id, token, expiresAt)

  const link = `${config.frontendUrl}/reset_password?token=${token}`

  try {
    await mailer.sendPasswordResetLink(user.email, link)
    console.log(`📩 Ссылка сброса пароля для ${user.login} (${maskEmail(user.email)})`)
  } catch (err) {
    // Ошибка SMTP не должна ронять запрос — логируем и продолжаем
    console.error(`❌ Не удалось отправить письмо для ${user.login}: ${err.message}`)
    console.log(`📧 [DEV-фолбэк] Ссылка: ${link}`)
  }

  return token
}

// POST /api/auth/forgot-password — отправка ссылки для сброса пароля
// Идентификация по СНИЛС: находим учётную запись и шлём ссылку на её почту
const forgotPassword = async (req, res) => {
  const { snils, email } = req.body || {}

  if (snils !== undefined && typeof snils !== 'string') {
    throw ApiError.badRequest('Укажите СНИЛС')
  }
  if (email !== undefined && typeof email !== 'string') {
    throw ApiError.badRequest('Укажите корректные данные')
  }
  if (!snils && !email) {
    throw ApiError.badRequest('Укажите СНИЛС')
  }
  if (email && email.length > 150) {
    throw ApiError.badRequest('Электронная почта не длиннее 150 символов')
  }

  let user = null

  if (snils) {
    const snilsDigits = studentModel.normalizeSnils(snils)
    if (!snilsDigits) throw ApiError.badRequest('СНИЛС должен содержать 11 цифр')
    user = await studentModel.findBySnils(snilsDigits)
  } else {
    user = await studentModel.findByEmail(email)
  }

  if (user && user.email) {
    await issueResetLink(user)
  } else if (user) {
    // Найден, но почта не указана — отправить некуда
    console.log(`📩 Сброс пароля: у ${user.login} не указана почта — письмо не отправлено`)
  } else {
    // Не раскрываем, существует ли учётная запись (защита от перечисления)
    console.log(`📩 Запрос сброса пароля: учётная запись не найдена (${snils ? `СНИЛС ***${String(snils).replace(/\D/g, '').slice(-3)}` : `почта ${maskEmail(email)}`})`)
  }

  // Ответ одинаковый в любом случае
  ok(res, null, {
    message: 'Если учётная запись найдена, ссылка для сброса пароля отправлена на почту, указанную при регистрации',
  })
}

// GET /api/auth/reset-password/:token — проверка ссылки (открывается на странице)
const checkResetToken = async (req, res) => {
  const row = await passwordResetModel.findValid(req.params.token)

  if (!row) {
    throw ApiError.badRequest('Ссылка недействительна или истекла')
  }

  ok(res, { email: maskEmail(row.email), expiresAt: row.expires_at })
}

// POST /api/auth/reset-password — установка нового пароля по ссылке
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {}

  if (typeof token !== 'string' || !token) throw ApiError.badRequest('Токен не передан')
  if (typeof password !== 'string' || password.length < 6) {
    throw ApiError.badRequest('Пароль должен содержать не менее 6 символов')
  }
  if (password.length > 72) throw ApiError.badRequest('Пароль не длиннее 72 символов')

  const row = await passwordResetModel.findValid(token)
  if (!row) {
    throw ApiError.badRequest('Ссылка недействительна или истекла')
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  await withTransaction(async (client) => {
    await studentModel.setPassword(row.user_id, hashedPassword, client)
    // Ссылка одноразовая: отзываем все активные токены пользователя
    await passwordResetModel.invalidateForUser(row.user_id, client)
  })

  console.log(`🔑 Пароль сброшен для ${row.login}`)
  ok(res, null, { message: 'Пароль успешно обновлён' })
}

// POST /api/auth/reset-link — отправка ссылки сброса для уже вошедшего пользователя.
// Идентификация по токену сессии (middleware authenticated), вводить СНИЛС не нужно.
const sendResetLink = async (req, res) => {
  const user = req.user

  if (!user.email) {
    throw ApiError.badRequest('Почта не указана — ссылку отправить некуда. Обратитесь к администратору')
  }

  await issueResetLink(user)
  console.log(`📩 Ссылка сброса запрошена самим пользователем ${user.login}`)

  // Уведомление: куда именно ушла ссылка (маскируем, но пользователь видит свою почту)
  ok(res, null, {
    message: `Ссылка для сброса пароля отправлена на вашу почту ${maskEmail(user.email)}. Ссылка действительна 5 минут`,
  })
}

module.exports = { me, login, register, logout, forgotPassword, sendResetLink, checkResetToken, resetPassword }
