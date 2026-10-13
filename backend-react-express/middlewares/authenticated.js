const ApiError = require('../utils/ApiError')
const { verify } = require('../utils/token')
const studentModel = require('../models/student.model')
const sessionModel = require('../models/session.model')

// Проверяет токен (cookie или заголовок Authorization: Bearer ...)
// и кладёт пользователя в req.user
module.exports = async function (req, res, next) {
  try {
    let token = req.cookies.token

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7)
    }

    if (!token) {
      throw ApiError.unauthorized('Пользователь не авторизован. Авторизуйтесь!')
    }

    // Любая ошибка разбора/проверки токена (протухший, битый, чужой ключ) → 401
    let tokenData
    try {
      tokenData = verify(token)
    } catch {
      return next(ApiError.unauthorized('Сессия недействительна. Авторизуйтесь!'))
    }

    const user = await studentModel.findById(tokenData.id)
    if (!user) {
      throw ApiError.unauthorized('Authenticated user not found')
    }

    req.user = user

    // фиксируем активность сессии для аналитики («онлайн сейчас»), не тормозя ответ
    if (tokenData.sid) {
      sessionModel.touch(tokenData.sid).catch(() => {})
    }

    next()
  } catch (error) {
    next(error)
  }
}
