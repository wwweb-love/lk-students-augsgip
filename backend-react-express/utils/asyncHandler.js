// Оборачивает async-обработчик: любая ошибка уходит в единый errorHandler
module.exports = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next)
