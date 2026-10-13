// Тест портфолио (загрузка, квота 100 МБ, скачивание, удаление) — npm run test:portfolio
const { generate } = require('../utils/token')

const BASE = 'http://127.0.0.1:3000'
const userToken = generate({ id: 3 }) // roman (Student) — владелец документов
const otherToken = generate({ id: 1 }) // Roman (Admin) — чужой пользователь
const LIMIT = 100 * 1024 * 1024

const FILENAME = 'Тест док.pdf'
const content = Buffer.alloc(1024)
for (let i = 0; i < content.length; i++) content[i] = i % 256

let passed = 0
let failed = 0
const createdIds = []

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? passed++ : failed++
}

async function get(path, token = null) {
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json, headers: res.headers }
}

async function upload(token, filename, bytes, mime = 'application/pdf') {
  const res = await fetch(
    `${BASE}/api/portfolio${filename !== null ? `?filename=${encodeURIComponent(filename)}` : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': mime, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: bytes,
    }
  )
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function cleanup() {
  try {
    const { pool } = require('../db/pool')
    if (createdIds.length) {
      await pool.query('DELETE FROM portfolio_documents WHERE id = ANY($1)', [createdIds])
    }
    await pool.end()
    console.log('\nВременные документы удалены')
  } catch (e) {
    console.error('cleanup ERR', e.message)
  }
}

;(async () => {
  // 1-2. Только авторизованные
  let r = await get('/api/portfolio')
  check('1. GET /portfolio без токена → 401', r.status === 401, `status=${r.status}`)

  let u = await upload(null, FILENAME, content)
  check('2. POST /portfolio без токена → 401', u.status === 401, `status=${u.status}`)

  // 3-4. Валидация входных данных
  u = await upload(userToken, null, content)
  check('3. POST без имени файла → 400', u.status === 400, u.json?.error || `status=${u.status}`)

  u = await upload(userToken, 'empty.txt', Buffer.alloc(0), 'text/plain')
  check('4. POST пустого файла → 400', u.status === 400, u.json?.error || `status=${u.status}`)

  // 5. Загрузка (кириллица в имени, байты сохраняются)
  u = await upload(userToken, FILENAME, content)
  const docId = u.json?.data?.document?.id
  if (docId) createdIds.push(docId)
  check(
    '5. загрузка файла → 201, имя и размер сохранены',
    u.status === 201 &&
      u.json?.data?.document?.filename === FILENAME &&
      u.json?.data?.document?.size_bytes === content.length,
    `status=${u.status} id=${docId}`
  )

  // 6. Список и квота
  r = await get('/api/portfolio', userToken)
  const data = r.json?.data
  const inList = (data?.documents || []).some((d) => d.id === docId)
  check(
    '6. список: файл виден, limitBytes = 100 МБ',
    r.status === 200 && inList && data?.limitBytes === LIMIT && data?.totalBytes >= content.length,
    `total=${data?.totalBytes} limit=${data?.limitBytes}`
  )

  // 7. Скачивание: байты один в один, кириллица в Content-Disposition
  const dl = await fetch(`${BASE}/api/portfolio/${docId}`, {
    headers: { Authorization: `Bearer ${userToken}` },
  })
  const buf = Buffer.from(await dl.arrayBuffer())
  const cd = dl.headers.get('content-disposition') || ''
  check(
    '7. скачивание: 200, байты совпадают, filename*=UTF-8',
    dl.status === 200 &&
      buf.equals(content) &&
      cd.includes(`filename*=UTF-8''${encodeURIComponent(FILENAME)}`) &&
      dl.headers.get('content-type') === 'application/pdf',
    `status=${dl.status} cd=${cd.slice(0, 60)}`
  )

  // 8-9. Чужие документы недоступны
  const dlOther = await fetch(`${BASE}/api/portfolio/${docId}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  })
  check('8. чужое скачивание → 404', dlOther.status === 404, `status=${dlOther.status}`)

  const delOther = await fetch(`${BASE}/api/portfolio/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${otherToken}` },
  })
  check('9. чужое удаление → 404', delOther.status === 404, `status=${delOther.status}`)

  // 10. Квота 100 МБ: раздуваем размер своего файла до лимита (только в тесте),
  // следующая загрузка обязана упасть с понятной ошибкой
  const { pool } = require('../db/pool')
  await pool.query('UPDATE portfolio_documents SET size_bytes = $1 WHERE id = $2', [LIMIT, docId])
  u = await upload(userToken, 'over.txt', Buffer.from('x'), 'text/plain')
  if (u.json?.data?.document?.id) createdIds.push(u.json.data.document.id)
  check(
    '10. превышение лимита 100 МБ → 400 с текстом про лимит',
    u.status === 400 && (u.json?.error || '').includes('100 МБ'),
    u.json?.error || `status=${u.status}`
  )

  // 11. Удаление своего документа
  const del = await fetch(`${BASE}/api/portfolio/${docId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userToken}` },
  })
  const delJson = await del.json().catch(() => null)
  r = await get('/api/portfolio', userToken)
  const stillThere = (r.json?.data?.documents || []).some((d) => d.id === docId)
  check(
    '11. удаление: 200, из списка исчез',
    del.status === 200 && delJson?.error === null && !stillThere,
    `status=${del.status}`
  )

  await cleanup()
  console.log(`\nИтого: ${passed} PASS, ${failed} FAIL`)
  process.exit(failed ? 1 : 0)
})().catch(async (e) => {
  console.error('FATAL', e)
  await cleanup()
  process.exit(1)
})
