// Smoke-тест API: npm test (сервер должен быть запущен)
const { generate } = require('../utils/token')

const BASE = 'http://127.0.0.1:3000'
const token = generate({ id: 1 }) // Admin (Roman)
const studentToken = generate({ id: 3 }) // Student (roman)

async function call(name, path, opts = {}, expectStatus) {
  const res = await fetch(BASE + path, opts)
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  const statusOk = expectStatus ? res.status === expectStatus : res.ok
  console.log(`${statusOk ? 'PASS' : 'FAIL'} | ${name} | HTTP ${res.status}${expectStatus ? ` (ожидалось ${expectStatus})` : ''}`)
  const preview = typeof body === 'string' ? body.slice(0, 120) : JSON.stringify(body).slice(0, 220)
  console.log(`       ${preview}`)
  return { res, body }
}

;(async () => {
  await call('1. GET / (health)', '/', {}, 200)

  await call('2. login: неверный пароль', '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'Roman', password: 'wrongpass' }),
  }, 401)

  await call('3. login: нет пользователя', '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'nobody999', password: 'wrongpass' }),
  }, 401)

  await call('4. /me с валидным токеном', '/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }, 200)

  await call('5. /me без токена', '/api/auth/me', {}, 401)

  await call('6. /me с битым токеном', '/api/auth/me', {
    headers: { Authorization: 'Bearer abc.def.ghi' },
  }, 401)

  const sched = await call('7. расписание с токеном', '/api/schedules?date=20260928', {
    headers: { Authorization: `Bearer ${token}` },
  }, 200)
  if (sched.body && Array.isArray(sched.body.data)) {
    console.log(`       дней в массиве: ${sched.body.data.length}, пар всего: ${sched.body.data.flat().length}`)
  }

  await call('8. расписание без date', '/api/schedules', {
    headers: { Authorization: `Bearer ${token}` },
  }, 400)

  await call('9. расписание без токена', '/api/schedules?date=20260928', {}, 401)

  await call('10. register: не все данные', '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snils: '123' }),
  }, 400)

  await call('11. register: СНИЛС не найден', '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snils: '000-000-000 00', login: 'testuser', password: '123456', email: 'test@test.ru' }),
  }, 400)

  await call('12. logout', '/api/auth/logout', { method: 'POST' }, 200)

  await call('13. неизвестный /api маршрут', '/api/nope', {}, 404)

  // --- роли ---
  await call('14. /users: Admin → 200', '/api/users', {
    headers: { Authorization: `Bearer ${token}` },
  }, 200)

  await call('15. /users: Student → 403', '/api/users', {
    headers: { Authorization: `Bearer ${studentToken}` },
  }, 403)

  await call('16. расписание: Student → 200', '/api/schedules?date=20260112', {
    headers: { Authorization: `Bearer ${studentToken}` },
  }, 200)

  await call('17. /me возвращает role', '/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }, 200).then(({ body }) => {
    console.log(`       role = ${body?.data?.role}`)
  })

  // --- успеваемость ---
  const grades = await call('18. /grades: Student → 200', '/api/grades', {
    headers: { Authorization: `Bearer ${studentToken}` },
  }, 200)
  if (grades.body?.data) {
    console.log(`       записей журнала: ${grades.body.data.grades?.length}, средний балл: ${grades.body.data.summary?.average}`)
  }

  await call('19. /grades без токена → 401', '/api/grades', {}, 401)

  await call('20. /grades: Student запрашивает чужую группу → 403', '/api/grades?group=9С-254', {
    headers: { Authorization: `Bearer ${studentToken}` },
  }, 403)

  // --- мессенджер ---
  const found = await call('21. /messages/search: Student → 200', '/api/messages/search?q=Абак', {
    headers: { Authorization: `Bearer ${studentToken}` },
  }, 200)
  if (found.body?.data) {
    console.log(`       найдено студентов: ${found.body.data.students?.length}`)
  }

  await call('22. /messages/search без токена → 401', '/api/messages/search?q=Иванов', {}, 401)

  await call('23. /messages/search: короткий запрос → 400', '/api/messages/search?q=а', {
    headers: { Authorization: `Bearer ${token}` },
  }, 400)

  await call('24. /messages: пустое сообщение → 400', '/api/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_snils: '17020646630', body: '   ' }),
  }, 400)

  const threads = await call('25. /messages/threads: Student → 200', '/api/messages/threads', {
    headers: { Authorization: `Bearer ${studentToken}` },
  }, 200)
  if (threads.body?.data) {
    console.log(`       диалогов: ${threads.body.data.threads?.length}`)
  }

  console.log('\nГотово.')
  process.exit(0)
})().catch((e) => { console.error('Ошибка теста:', e); process.exit(1) })
