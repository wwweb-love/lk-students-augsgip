const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const { uploadLimiter } = require('../middlewares/rateLimit')
const asyncHandler = require('../utils/asyncHandler')
const portfolioController = require('../controllers/portfolio.controller')

// Список документов и квота пользователя
router.get('/', authenticated, asyncHandler(portfolioController.list))

// Загрузка: тело — сырые байты файла (лимит ровно 100 МБ за запрос,
// дальше body-parser сам отвечает 413 и даже не пишет в БД)
router.post(
  '/',
  authenticated,
  uploadLimiter,
  express.raw({ type: () => true, limit: '100mb' }),
  asyncHandler(portfolioController.upload)
)

// Скачивание и удаление — только своих документов (user_id в условиях модели)
router.get('/:id', authenticated, asyncHandler(portfolioController.download))
router.delete('/:id', authenticated, asyncHandler(portfolioController.remove))

module.exports = router
