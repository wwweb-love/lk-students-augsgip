// Интеграционный тест сброса пароля: npm run test:reset
// Создаёт тестового студента, проходит весь флоу и удаляет данные.
const bcrypt = require('bcrypt')
const { pool } = require('../db/pool')

const BASE = 'http://127.0.0.1:3000'
const EMAIL = 'pwreset_test@test.local'
const SNILS = '99999999999'
const OLD_PASS = 'OldPass123'
const NEW_PASS = 'NewPass456'
let userId = null

let passed = 0
let failed = 0
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? passed++ : failed++
}

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function cleanup() {
  if (userId) {
    // токени удалятся каскадом вместе со студентом
    await pool.query('DELETE FROM students WHERE id = $1', [userId])
    userId = null
    console.log('\nТестовый студент и его токены удалены')
  }
  await pool.end()
}

;(async () => {
  // 0. Тестовый студент
  const hash = await bcrypt.hash(OLD_PASS, 10)
  const ins = await pool.query(
    `INSERT INTO students (name, specialty, group_name, login, password, email, snils, role)
     VALUES ('Тест Сброс', 'x', '9С-254', 'pwreset_test', $1, $2, '99999999999', 'Student')
     RETURNING id`,
    [hash, EMAIL]
  )
  userId = ins.rows[0].id
  console.log(`Тестовый студент id=${userId} создан\n`)

  // 1. Запрос ссылки на неизвестный СНИЛС — ответ не раскрывает существование
  let r = await call('POST', '/api/auth/forgot-password', { snils: '00000000000' })
  check('1. forgot-password: неизвестный СНИЛС → 200, одинаковый ответ', r.status === 200 && r.data.error === null)

  // 2. Запрос ссылки по реальному СНИЛС (с дефисами — проверка нормализации)
  r = await call('POST', '/api/auth/forgot-password', { snils: '999-999-999 99' })
  check('2. forgot-password: реальный СНИЛС с дефисами → 200', r.status === 200 && r.data.error === null)

  // 2b. Запрос ссылки по email (альтернативный путь) — тоже работает
  r = await call('POST', '/api/auth/forgot-password', { email: EMAIL })
  check('2b. forgot-password: по email → 200', r.status === 200 && r.data.error === null)

  // 3. Без данных → 400
  r = await call('POST', '/api/auth/forgot-password', {})
  check('3. forgot-password: без СНИЛС → 400', r.status === 400)

  // 3b. Короткий СНИЛС → 400
  r = await call('POST', '/api/auth/forgot-password', { snils: '12345' })
  check('3b. forgot-password: СНИЛС не 11 цифр → 400', r.status === 400, r.data?.error || '')

  // 4. Достаём токен из БД и проверяем срок
  // TTL меряем от created_at, а не от текущего момента:
  // на отправку SMTP-письма уходит время, и оно не должно уменьшать TTL в тесте
  const tok = await pool.query(
    'SELECT token, created_at, expires_at FROM password_resets WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [userId]
  )
  const token = tok.rows[0].token
  const ttlMin = (new Date(tok.rows[0].expires_at) - new Date(tok.rows[0].created_at)) / 60000
  const stillValid = new Date(tok.rows[0].expires_at) > new Date()
  check('4. токен создан, TTL ≈ 5 минут', ttlMin > 4.9 && ttlMin <= 5.05 && stillValid,
    `TTL=${ttlMin.toFixed(2)} мин, активна=${stillValid}`)

  // 5. Повторный запрос отзывает старый токен (активна только последняя ссылка)
  await call('POST', '/api/auth/forgot-password', { snils: SNILS })
  const tok2 = await pool.query(
    'SELECT token FROM password_resets WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [userId]
  )
  const active = await pool.query(
    'SELECT count(*)::int AS n FROM password_resets WHERE user_id = $1 AND used = false',
    [userId]
  )
  check('5. после повторного запроса активна только одна ссылка', active.rows[0].n === 1)
  const token2 = tok2.rows[0].token

  // 6. Проверка ссылки — валидна
  r = await call('GET', `/api/auth/reset-password/${token2}`)
  check('6. GET reset-password/:token валидный → 200', r.status === 200 && !!r.data.data?.email)

  // 7. Мусорный токен
  r = await call('GET', '/api/auth/reset-password/deadbeefdeadbeef')
  check('7. GET reset-password/:token мусорный → 400', r.status === 400)

  // 8. Сброс: короткий пароль → 400
  r = await call('POST', '/api/auth/reset-password', { token: token2, password: '123' })
  check('8. reset-password: пароль < 6 символов → 400', r.status === 400)

  // 9. Сброс: старый (отозванный) токен → 400
  r = await call('POST', '/api/auth/reset-password', { token, password: NEW_PASS })
  check('9. reset-password: отозванный токен → 400', r.status === 400)

  // 10. Сброс новым токеном → 200
  r = await call('POST', '/api/auth/reset-password', { token: token2, password: NEW_PASS })
  check('10. reset-password: новый токен → 200', r.status === 200 && r.data.error === null)

  // 11. Старый пароль больше не работает
  r = await call('POST', '/api/auth/login', { login: 'pwreset_test', password: OLD_PASS })
  check('11. login старым паролем → 401', r.status === 401)

  // 12. Новый пароль работает
  r = await call('POST', '/api/auth/login', { login: 'pwreset_test', password: NEW_PASS })
  check('12. login новым паролем → 200 + токен', r.status === 200 && !!r.data.token)

  // 13. Повторное использование той же ссылки → 400 (одноразовая)
  r = await call('POST', '/api/auth/reset-password', { token: token2, password: 'Another777' })
  check('13. reuse токена → 400 (одноразовая)', r.status === 400)

  // 14. Истёкший токен → 400
  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at, used)
     VALUES ($1, 'expiredtoken1234567890expiredtoken1234567890', now() - interval '1 minute', false)`,
    [userId]
  )
  r = await call('GET', '/api/auth/reset-password/expiredtoken1234567890expiredtoken1234567890')
  check('14. истёкший токен → 400', r.status === 400)

  console.log(`\nИтого: ${passed} PASS, ${failed} FAIL`)
  process.exitCode = failed === 0 ? 0 : 1
})().catch(async (e) => {
  console.error('ERR', e)
  process.exitCode = 1
}).finally(cleanup)
