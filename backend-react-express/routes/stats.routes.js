const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const hasRole = require('../middlewares/hasRole')
const asyncHandler = require('../utils/asyncHandler')
const statsController = require('../controllers/stats.controller')

// Статистика админ-панели — только Admin
router.get('/', authenticated, hasRole(['Admin']), asyncHandler(statsController.getStats))

module.exports = router
