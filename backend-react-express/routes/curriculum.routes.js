const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const hasRole = require('../middlewares/hasRole')
const asyncHandler = require('../utils/asyncHandler')
const curriculumController = require('../controllers/curriculum.controller')

// Учебный план группы текущего пользователя (доступно всем, кроме Guest)
router.get(
  '/',
  authenticated,
  hasRole(['Admin', 'Teacher', 'Student']),
  asyncHandler(curriculumController.getMyCurriculum)
)

module.exports = router
