const bcrypt = require('bcrypt')

const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const studentModel = require('../models/student.model')
const safeUser = require('../utils/safeUser')

const ROLES = ['Admin', 'Teacher', 'Student', 'Guest']
const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 72

// Ответ без хеша пароля (общий хелпер utils/safeUser)
const safe = safeUser

function validateRole(role) {
  if (!ROLES.includes(role)) {
    throw ApiError.badRequest(`Недопустимая роль. Допустимы: ${ROLES.join(', ')}`)
  }
}

function validatePassword(password, { required }) {
  if (password === undefined || password === null || password === '') {
    if (required) throw ApiError.badRequest('Укажите пароль')
    return null // не менять
  }
  if (typeof password !== 'string') {
    throw ApiError.badRequest('Укажите корректный пароль')
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw ApiError.badRequest(`Пароль должен содержать не менее ${PASSWORD_MIN_LENGTH} символов`)
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw ApiError.badRequest(`Пароль не длиннее ${PASSWORD_MAX_LENGTH} символов`)
  }
  return bcrypt.hash(password, 10)
}

function validateEmail(email) {
  if (email === undefined) return undefined // не менять
  if (email === null || email === '') return null // очистить
  if (typeof email !== 'string') throw ApiError.badRequest('Некорректная электронная почта')
  const value = email.trim()
  if (!value.includes('@') || !value.includes('.')) {
    throw ApiError.badRequest('Некорректная электронная почта')
  }
  if (value.length > 150) {
    throw ApiError.badRequest('Электронная почта не длиннее 150 символов')
  }
  return value
}

// СНИЛС обязателен: нормализуется до 11 цифр, иначе 400
function validateSnils(snils) {
  const digits = studentModel.normalizeSnils(snils)
  if (!digits) throw ApiError.badRequest('СНИЛС должен содержать 11 цифр')
  return digits
}

// GET /api/users — список студентов (только Admin)
const list = async (req, res) => {
  const users = await studentModel.findAll()
  ok(res, users)
}

// POST /api/users — создание пользователя (только Admin)
const create = async (req, res) => {
  const { name, specialty, group_name, login, password, email, snils, role } = req.body || {}

  if (typeof name !== 'string' || !name.trim()) throw ApiError.badRequest('Укажите ФИО')
  if (typeof login !== 'string' || !login.trim()) throw ApiError.badRequest('Укажите логин')
  if (name.trim().length > 150) throw ApiError.badRequest('ФИО не длиннее 150 символов')
  if (login.trim().length > 50) throw ApiError.badRequest('Логин не длиннее 50 символов')
  if (specialty != null && typeof specialty !== 'string') throw ApiError.badRequest('Некорректная специальность')
  if (specialty && specialty.length > 150) throw ApiError.badRequest('Специальность не длиннее 150 символов')
  if (group_name != null && typeof group_name !== 'string') throw ApiError.badRequest('Некорректная группа')
  if (group_name && group_name.length > 50) throw ApiError.badRequest('Группа не длиннее 50 символов')

  const hashedPassword = await validatePassword(password, { required: true })
  const snilsDigits = validateSnils(snils)
  const emailValue = validateEmail(email)
  const finalRole = role || 'Student'
  validateRole(finalRole)

  const user = await studentModel.create({
    name: String(name).trim(),
    specialty: specialty || null,
    group_name: group_name || null,
    login: String(login).trim(),
    password: hashedPassword,
    email: emailValue === undefined ? null : emailValue,
    snils: snilsDigits,
    role: finalRole,
  })

  ok(res, safe(user))
}

// PUT /api/users/:id — редактирование (только Admin)
const update = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw ApiError.badRequest('Некорректный id')

  const existing = await studentModel.findById(id)
  if (!existing) throw ApiError.notFound('Пользователь не найден')

  const fields = {}
  const body = req.body || {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) throw ApiError.badRequest('ФИО не может быть пустым')
    if (body.name.trim().length > 150) throw ApiError.badRequest('ФИО не длиннее 150 символов')
    fields.name = body.name.trim()
  }
  if (body.login !== undefined) {
    if (typeof body.login !== 'string' || !body.login.trim()) throw ApiError.badRequest('Логин не может быть пустым')
    if (body.login.trim().length > 50) throw ApiError.badRequest('Логин не длиннее 50 символов')
    fields.login = body.login.trim()
  }
  if (body.specialty !== undefined) {
    if (body.specialty != null && typeof body.specialty !== 'string') throw ApiError.badRequest('Некорректная специальность')
    if (body.specialty && body.specialty.length > 150) throw ApiError.badRequest('Специальность не длиннее 150 символов')
    fields.specialty = body.specialty || null
  }
  if (body.group_name !== undefined) {
    if (body.group_name != null && typeof body.group_name !== 'string') throw ApiError.badRequest('Некорректная группа')
    if (body.group_name && body.group_name.length > 50) throw ApiError.badRequest('Группа не длиннее 50 символов')
    fields.group_name = body.group_name || null
  }

  if (body.email !== undefined) fields.email = validateEmail(body.email)

  if (body.snils !== undefined) {
    fields.snils = validateSnils(body.snils)
  }

  if (body.role !== undefined) {
    validateRole(body.role)
    if (id === req.user.id) {
      throw ApiError.badRequest('Нельзя изменить собственную роль')
    }
    fields.role = body.role
  }

  if (body.password !== undefined) {
    const hashed = await validatePassword(body.password, { required: false })
    if (hashed) fields.password = hashed
  }

  const updated = await studentModel.updateById(id, fields)
  ok(res, safe(updated))
}

// DELETE /api/users/:id — удаление (только Admin)
const remove = async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw ApiError.badRequest('Некорректный id')

  if (id === req.user.id) {
    throw ApiError.badRequest('Нельзя удалить собственную учётную запись')
  }

  const deleted = await studentModel.removeById(id)
  if (!deleted) throw ApiError.notFound('Пользователь не найден')

  ok(res, null, { message: 'Пользователь удалён' })
}

module.exports = { list, create, update, remove }
