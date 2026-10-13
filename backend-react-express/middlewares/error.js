const ApiError = require('../utils/ApiError')

// 404 для неизвестных /api маршрутов
function notFound(req, res, next) {
  next(ApiError.notFound(`Маршрут не найден: ${req.method} ${req.originalUrl}`))
}

// Единый обработчик ошибок: любая ошибка → { error, data: null }
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Некорректный JSON / слишком большое тело (body-parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный формат JSON', data: null })
  }
  if (err.type === 'entity.too.large') {
    // Для портфолио возвращаем понятный текст про лимит файлов
    const isPortfolio = (req.originalUrl || '').includes('/portfolio')
    return res.status(413).json({
      error: isPortfolio ? 'Файл больше 100 МБ' : 'Слишком большой запрос',
      data: null,
    })
  }

  // Нарушение уникальности в PostgreSQL (23505) → 400 вместо 500
  if (err.code === '23505') {
    const messages = {
      students_login_key: 'Этот login уже используется другим пользователем',
      students_email_key: 'Эта почта уже используется другим пользователем',
      students_snils_key: 'Пользователь с таким СНИЛС уже зарегистрирован',
    }
    const message = messages[err.constraint] || 'Такое значение уже существует'
    return res.status(400).json({ error: message, data: null })
  }

  // Выход за пределы типа данных PostgreSQL (int4 overflow и т.п.)
  if (err.code === '22003') {
    return res.status(400).json({ error: 'Некорректное значение параметра', data: null })
  }

  const status = err.status || err.statusCode || 500

  // Детали внутренних ошибок (SQL, стектрейс) — только в лог сервера,
  // клиенту — универсальный текст
  if (status >= 500) {
    console.error('❌ Ошибка сервера:', err)
    return res.status(status).json({ error: 'Внутренняя ошибка сервера', data: null })
  }

  res.status(status).json({
    error: err.message || 'Ошибка запроса',
    data: null,
  })
}

module.exports = { notFound, errorHandler }
