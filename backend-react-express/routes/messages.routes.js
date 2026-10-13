const express = require('express')
const router = express.Router()

const authenticated = require('../middlewares/authenticated')
const hasRole = require('../middlewares/hasRole')
const asyncHandler = require('../utils/asyncHandler')
const messagesController = require('../controllers/messages.controller')

// Мессенджер доступен всем авторизованным ролям (Student/Teacher/Admin)
const canChat = hasRole(['Admin', 'Teacher', 'Student'])

// Поиск студента по ФИО
router.get('/search', authenticated, canChat, asyncHandler(messagesController.searchStudents))

// Список диалогов
router.get('/threads', authenticated, canChat, asyncHandler(messagesController.listThreads))

// Переписка с участником (открывает и помечает прочитанным)
router.get('/thread', authenticated, canChat, asyncHandler(messagesController.listThread))

// Отправить сообщение
router.post('/', authenticated, canChat, asyncHandler(messagesController.send))

module.exports = router
