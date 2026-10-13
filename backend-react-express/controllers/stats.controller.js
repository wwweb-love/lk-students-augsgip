const { ok } = require('../utils/response')
const statsModel = require('../models/stats.model')

// GET /api/stats — сводка для админ-дашборда (только Admin)
const getStats = async (req, res) => {
  const stats = await statsModel.getStats()
  ok(res, stats)
}

module.exports = { getStats }
