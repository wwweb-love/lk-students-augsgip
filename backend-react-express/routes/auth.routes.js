const express = require('express')
const router = express.Router({ mergeParams: true })

const authenticated = require('../middlewares/authenticated')
const { loginLimiter, registerLimiter, forgotLimiter, resetLimiter } = require('../middlewares/rateLimit')
const asyncHandler = require('../utils/asyncHandler')
const authController = require('../controllers/auth.controller')

// текущий пользователь
router.get('/me', authenticated, asyncHandler(authController.me))

// вход (анти-брутфорс: 15 неудачных попыток за 15 минут на IP)
router.post('/login', loginLimiter, asyncHandler(authController.login))

// регистрация
router.post('/register', registerLimiter, asyncHandler(authController.register))

// выход
router.post('/logout', authController.logout)

// сброс пароля
router.post('/forgot-password', forgotLimiter, asyncHandler(authController.forgotPassword))
// сброс для уже вошедшего пользователя — идентификация по токену сессии, без СНИЛС
router.post('/reset-link', authenticated, forgotLimiter, asyncHandler(authController.sendResetLink))
router.get('/reset-password/:token', asyncHandler(authController.checkResetToken))
router.post('/reset-password', resetLimiter, asyncHandler(authController.resetPassword))

module.exports = router
