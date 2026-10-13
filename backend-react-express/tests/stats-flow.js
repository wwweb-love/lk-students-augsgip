// Тест аналитики админки (GET /api/stats) — npm run test:stats
// Проверяет права доступа, состав ответа, рост метрик при входе и закрытие сессии.
const { generate } = require('../utils/token')

const BASE = 'http://127.0.0.1:3000'
const adminToken = generate({ id: 1 }) // Roman (Admin)
const studentToken = generate({ id: 3 }) // roman (Student)

const LOGIN = 'stat_test1'
const PASSWORD = 'Stat12345'
const SNILS = '99999999991'

let passed = 0
let failed = 0
let createdId = null

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? passed++ : failed++
}

async function get(path, token = null) {
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

async function cleanup() {
  try {
    const { pool } = require('../db/pool')
    await pool.query(`DELETE FROM students WHERE login = $1`, [LOGIN])
    await pool.end()
    console.log('\nВременные данные удалены')
  } catch (e) {
    console.error('cleanup ERR', e.message)
  }
}

;(async () => {
  // 1-2. Доступ по ролям
  let r = await get('/api/stats')
  check('1. GET /stats без токена → 401', r.status === 401, `status=${r.status}`)

  r = await get('/api/stats', studentToken)
  check('2. GET /stats: Student → 403', r.status === 403, `status=${r.status}`)

  // 3. Админ получает сводку
  r = await get('/api/stats', adminToken)
  check('3. GET /stats: Admin → 200', r.status === 200, `status=${r.status}`)
  const before = r.json?.data
  const shapeOk = !!before &&
    typeof before.todayLogins === 'number' &&
    typeof before.todayUsers === 'number' &&
    typeof before.activeSessions === 'number' &&
    typeof before.totalUsers === 'number' &&
    typeof before.registrationsWeek === 'number' &&
    Array.isArray(before.logins7d) && before.logins7d.length === 7 &&
    before.logins7d.every((d) => d.day && typeof d.logins === 'number') &&
    !!before.roles
  check('4. состав ответа (KPI, 7 дней, роли)', shapeOk, JSON.stringify(before?.roles))

  // 5. Создание пользователя (сессия появится после входа)
  const created = await fetch(BASE + '/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Тест Аналитики', login: LOGIN, password: PASSWORD, email: 'stat_t@test.local', snils: SNILS, role: 'Student' }),
  }).then((x) => x.json())
  createdId = created?.data?.id
  check('5. временный пользователь создан', !!createdId, `id=${createdId}`)

  // 6. Вход создаёт сессию с sid в токене
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
  }).then((x) => x.json())
  const claims = loginRes.token
    ? JSON.parse(Buffer.from(loginRes.token.split('.')[1], 'base64url').toString())
    : {}
  check('6. токен входа содержит sid', !!claims.sid, `sid=${claims.sid ? 'есть' : 'нет'}`)

  // 7-8. Метрики выросли на единицу
  r = await get('/api/stats', adminToken)
  const after = r.json?.data
  check('7. входов сегодня +1', after.todayLogins === before.todayLogins + 1, `${before.todayLogins} → ${after.todayLogins}`)
  check('8. активных сессий +1', after.activeSessions >= before.activeSessions + 1, `${before.activeSessions} → ${after.activeSessions}`)

  // 9. Logout закрывает сессию в БД
  await fetch(BASE + '/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginRes.token}` },
  })
  const { pool } = require('../db/pool')
  const closed = await pool.query('SELECT ended_at FROM sessions WHERE sid = $1', [claims.sid])
  check('9. logout закрыл сессию (ended_at)', closed.rows.length === 1 && closed.rows[0].ended_at !== null,
    `ended_at=${closed.rows[0]?.ended_at || 'null'}`)

  // 10. Целостность: сумма ролей = всего пользователей
  const sum = Object.values(after.roles).reduce((a, b) => a + b, 0)
  check('10. сумма ролей == totalUsers', sum === after.totalUsers, `${sum} == ${after.totalUsers}`)

  // 11. Онлайн-сессий не больше, чем людей (сессия одна на вход)
  check('11. activeUsers <= activeSessions', after.activeUsers <= after.activeSessions,
    `${after.activeUsers} ≤ ${after.activeSessions}`)

  // 12-15. Ссылка сброса для вошедшего пользователя (идентификация по токену, без СНИЛС)
  let rr = await fetch(BASE + '/api/auth/reset-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  check('12. reset-link без токена → 401', rr.status === 401, `status=${rr.status}`)

  rr = await fetch(BASE + '/api/auth/reset-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginRes.token}` },
  })
  const rrJson = await rr.json().catch(() => ({}))
  check('13. reset-link с токеном → 200 + уведомление с почтой',
    rr.status === 200 && typeof rrJson.message === 'string' && rrJson.message.includes('сброса пароля'),
    rrJson.message || `status=${rr.status}`)

  const tok1 = await pool.query(
    `SELECT count(*)::int AS c FROM password_resets
     WHERE user_id = $1 AND used = false AND expires_at > now()`,
    [createdId]
  )
  check('14. токен сброса создан', tok1.rows[0].c === 1, `active=${tok1.rows[0].c}`)

  // Повторное нажатие — старая ссылка отзывается, активна ровно одна
  await fetch(BASE + '/api/auth/reset-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginRes.token}` },
  })
  const tok2 = await pool.query(
    `SELECT count(*)::int AS c FROM password_resets
     WHERE user_id = $1 AND used = false AND expires_at > now()`,
    [createdId]
  )
  check('15. повторная отправка: активна ровно одна ссылка', tok2.rows[0].c === 1, `active=${tok2.rows[0].c}`)

  await cleanup()
  console.log(`\nИтого: ${passed} PASS, ${failed} FAIL`)
  process.exit(failed ? 1 : 0)
})().catch(async (e) => {
  console.error('FATAL', e)
  await cleanup()
  process.exit(1)
})
