const rateLimit = require('express-rate-limit')

const WINDOW_MS = 15 * 60 * 1000 // 15 минут

// Фабрика лимитеров в формате ответа { error, data }
function makeLimiter(limit, opts = {}) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true, // заголовок RateLimit-* (draft)
    legacyHeaders: false,
    message: { error: 'Слишком много запросов. Попробуйте позже.', data: null },
    ...opts,
  })
}

// Вход: учитываются только неудачные попытки — легитимный пользователь
// не пострадает от лимита, а брутфорс упирается в потолок (15/15 мин на IP)
const loginLimiter = makeLimiter(15, { skipSuccessfulRequests: true })

// Регистрация и сброс пароля: уходят письма, считаем все запросы
const registerLimiter = makeLimiter(20)
const forgotLimiter = makeLimiter(20)

// Смена пароля по токену (токен 256 бит, лимит — страховка от перебора)
const resetLimiter = makeLimiter(30)

// Портфолио: байты ограничены квотой 100 МБ на пользователя,
// лимитер защищает от флуда мелкими файлами (раздувание числа строк)
const uploadLimiter = makeLimiter(60)

module.exports = { loginLimiter, registerLimiter, forgotLimiter, resetLimiter, uploadLimiter }
