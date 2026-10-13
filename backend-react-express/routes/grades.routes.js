const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const hasRole = require('../middlewares/hasRole')
const asyncHandler = require('../utils/asyncHandler')
const gradesController = require('../controllers/grades.controller')

// Журнал оценок текущего пользователя (доступно всем, кроме Guest).
// Teacher/Admin дополнительно могут запросить ?snils=... или ?group=...
router.get(
  '/',
  authenticated,
  hasRole(['Admin', 'Teacher', 'Student']),
  asyncHandler(gradesController.getMyGrades)
)

module.exports = router
