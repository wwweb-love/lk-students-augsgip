// Единый формат ответов API: { error, data }
function ok(res, data = null, extra = {}) {
  return res.json({ error: null, data, ...extra })
}

function fail(res, error, status = 500) {
  const message = error?.message || String(error)
  return res.status(status).json({ error: message, data: null })
}

module.exports = { ok, fail }
