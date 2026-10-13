const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const messagesModel = require('../models/messages.model')

// GET /api/messages/search?q=Иванов — поиск студента по ФИО (ростер students_1c).
// Минимум 2 символа, чтобы не отдавать список всем подряд.
const searchStudents = async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) throw ApiError.badRequest('Введите минимум 2 символа для поиска')

  const excludeSnils = messagesModel.normalizeSnils(req.user.snils)
  const students = await messagesModel.searchStudents(q, excludeSnils)
  ok(res, { students })
}

// GET /api/messages/threads — список диалогов с последним сообщением и непрочитанными
const listThreads = async (req, res) => {
  const threads = await messagesModel.listThreads({
    userId: req.user.id,
    userSnils: messagesModel.normalizeSnils(req.user.snils),
  })
  ok(res, { threads })
}

// GET /api/messages/thread?snils=... — переписка с участником;
// открытые входящие помечаются прочитанными.
const listThread = async (req, res) => {
  const peerSnils = messagesModel.normalizeSnils(req.query.snils)
  if (!peerSnils) throw ApiError.badRequest('Параметр snils обязателен (11 цифр)')

  const userSnils = messagesModel.normalizeSnils(req.user.snils)
  if (peerSnils === userSnils) throw ApiError.badRequest('Нельзя открыть переписку с самим собой')

  // Сначала помечаем входящие прочитанными — чтобы в ответе сразу отражалось прочтение
  const markedRead = await messagesModel.markThreadRead({ userSnils, peerSnils })
  const messages = await messagesModel.listThread({ userId: req.user.id, userSnils, peerSnils })
  ok(res, { messages, marked_read: markedRead })
}

// POST /api/messages { recipient_snils, body } — отправить сообщение
const send = async (req, res) => {
  const recipientSnils = messagesModel.normalizeSnils(req.body?.recipient_snils)
  if (!recipientSnils) throw ApiError.badRequest('Получатель не указан: нужен СНИЛС из 11 цифр')

  const body = String(req.body?.body || '').trim()
  if (!body) throw ApiError.badRequest('Текст сообщения пуст')
  if (body.length > 2000) throw ApiError.badRequest('Сообщение слишком длинное (максимум 2000 символов)')

  const userSnils = messagesModel.normalizeSnils(req.user.snils)
  if (userSnils && recipientSnils === userSnils) {
    throw ApiError.badRequest('Нельзя написать сообщение самому себе')
  }

  // Адресат должен существовать в ростере 1С или быть зарегистрирован —
  // иначе сообщение никто никогда не увидит.
  const recipient = await messagesModel.findRecipient(recipientSnils)
  if (!recipient) throw ApiError.notFound('Студент с таким СНИЛС не найден')

  const message = await messagesModel.sendMessage({
    senderId: req.user.id,
    senderSnils: userSnils,
    senderName: req.user.name,
    recipientSnils,
    recipientName: recipient.name,
    body,
  })

  ok(res, { message })
}

module.exports = { searchStudents, listThreads, listThread, send }
