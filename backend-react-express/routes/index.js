const express = require('express')
const router = express.Router()

router.use('/auth', require('./auth.routes'))
router.use('/schedules', require('./schedules.routes'))
router.use('/users', require('./users.routes'))
router.use('/stats', require('./stats.routes'))
router.use('/portfolio', require('./portfolio.routes'))
router.use('/curriculum', require('./curriculum.routes'))
router.use('/grades', require('./grades.routes'))
router.use('/messages', require('./messages.routes'))

module.exports = router
