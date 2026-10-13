const ApiError = require('../utils/ApiError')

// Ограничивает доступ по роли пользователя (req.user.role)
// Использовать после authenticated: router.get('/', authenticated, hasRole(['Admin']), handler)
// Роли: Admin, Teacher, Student, Guest
module.exports = function (roles) {
  return (req, res, next) => {
    if (!roles.includes(String(req.user?.role))) {
      return next(ApiError.forbidden('Access denied'))
    }

    next()
  }
}
