const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const hasRole = require('../middlewares/hasRole')
const asyncHandler = require('../utils/asyncHandler')
const userController = require('../controllers/user.controller')

// Все маршруты пользователей — только Admin
router.get('/', authenticated, hasRole(['Admin']), asyncHandler(userController.list))
router.post('/', authenticated, hasRole(['Admin']), asyncHandler(userController.create))
router.put('/:id', authenticated, hasRole(['Admin']), asyncHandler(userController.update))
router.delete('/:id', authenticated, hasRole(['Admin']), asyncHandler(userController.remove))

module.exports = router
