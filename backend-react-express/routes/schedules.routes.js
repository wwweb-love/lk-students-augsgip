// http://sql1c-02/college_copy1/hs/student_lk//schedule/{StudentUID}/{DateStart}/{DateEnd}
const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const hasRole = require('../middlewares/hasRole')
const asyncHandler = require('../utils/asyncHandler')
const scheduleController = require('../controllers/schedule.controller')

// расписание за неделю (доступно всем, кроме Guest)
router.get(
  '/',
  authenticated,
  hasRole(['Admin', 'Teacher', 'Student']),
  asyncHandler(scheduleController.getWeek)
)

module.exports = router
