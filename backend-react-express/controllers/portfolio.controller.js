const ApiError = require('../utils/ApiError')
const { ok } = require('../utils/response')
const portfolioModel = require('../models/portfolio.model')

const MAX = portfolioModel.MAX_TOTAL_BYTES

// Имя файла из query: без управляющих символов и кавычек (защита заголовков),
// не длиннее 255 символов (размер колонки)
function sanitizeFilename(raw) {
  return String(raw || '')
    .replace(/[\r\n"\x00-\x1f]/g, '')
    .trim()
    .slice(0, 255)
}

// Content-Type файла: без кавычек/управляющих, ≤100 символов
function sanitizeMime(raw) {
  return String(raw || '')
    .replace(/["'\r\n\x00-\x1f]/g, '')
    .slice(0, 100) || 'application/octet-stream'
}

// GET /api/portfolio — свои документы + квота (100 МБ)
const list = async (req, res) => {
  const { documents, totalBytes } = await portfolioModel.listByUser(req.user.id)
  ok(res, { documents, totalBytes, limitBytes: MAX })
}

// POST /api/portfolio — загрузка. Тело запроса — сырые байты файла
// (express.raw до 100 МБ), имя файла передаётся в ?filename=.
const upload = async (req, res) => {
  const filename = sanitizeFilename(req.query.filename)
  if (!filename) throw ApiError.badRequest('Не передано имя файла')

  const data = Buffer.isBuffer(req.body) ? req.body : null
  if (!data || data.length === 0) throw ApiError.badRequest('Файл пустой')
  if (data.length > MAX) throw ApiError.badRequest('Файл больше 100 МБ')

  const mimeType = sanitizeMime(req.headers['content-type'])
  const { document, totalBytes } = await portfolioModel.createWithQuota({
    userId: req.user.id,
    filename,
    mimeType,
    data,
  })

  res.status(201)
  ok(res, { document, totalBytes, limitBytes: MAX })
}

// GET /api/portfolio/:id — скачивание байтов (только своих документов)
const download = async (req, res) => {
  const doc = await portfolioModel.findByIdForUser(req.params.id, req.user.id)
  if (!doc) throw ApiError.notFound('Документ не найден')

  // ASCII-фолбэк для старых клиентов + RFC 5987 для кириллицы
  const asciiName = doc.filename.replace(/[^\x20-\x7e]/g, '_')
  const rfc5987 = encodeURIComponent(doc.filename).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  )

  res.setHeader('Content-Type', doc.mime_type)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${rfc5987}`)
  res.send(doc.data)
}

// DELETE /api/portfolio/:id — удалить свой документ (чужой → 404)
const remove = async (req, res) => {
  const doc = await portfolioModel.remove(req.params.id, req.user.id)
  if (!doc) throw ApiError.notFound('Документ не найден')
  ok(res, { message: 'Документ удалён' })
}

module.exports = { list, upload, download, remove }
