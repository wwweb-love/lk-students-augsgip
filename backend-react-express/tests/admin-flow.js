// Тест админского CRUD пользователей — npm run test:admin
// Создаёт временного пользователя, проверяет операции и удаляет данные.
const { generate } = require('../utils/token')

const BASE = 'http://127.0.0.1:3000'
const adminToken = generate({ id: 1 }) // Roman (Admin)
const studentToken = generate({ id: 3 }) // roman (Student)

const LOGIN = 'adm_test1'
const EMAIL = 'adm_test1@test.local'
const SNILS = '66666666666'
const OLD_PASS = 'AdmOld123'
const NEW_PASS = 'AdmNew456'

let createdId = null
let passed = 0
let failed = 0

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? passed++ : failed++
}

async function call(method, path, body, token = adminToken) {
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
  try {
    const { pool } = require('../db/pool')
    await pool.query(`DELETE FROM students WHERE login LIKE 'adm_%'`)
    console.log('\nВременные пользователи удалены')
    await pool.end()
  } catch (e) {
    console.error('cleanup ERR', e.message)
  }
}

;(async () => {
  // 1-3. Не-админ получает 403 на все операции
  let r = await call('POST', '/api/users', { name: 'X', login: 'x', password: '123456', snils: SNILS }, studentToken)
  check('1. POST /users: Student → 403', r.status === 403)
  r = await call('PUT', '/api/users/1', { name: 'X' }, studentToken)
  check('2. PUT /users/1: Student → 403', r.status === 403)
  r = await call('DELETE', '/api/users/2', null, studentToken)
  check('3. DELETE /users/2: Student → 403', r.status === 403)

  // 4. Создание (СНИЛС с дефисами нормализуется)
  r = await call('POST', '/api/users', {
    name: 'Тест Админ',
    specialty: '54.02.01 Дизайн',
    group_name: '9Т-254',
    login: LOGIN,
    password: OLD_PASS,
    email: EMAIL,
    snils: '666-666-666 66',
    role: 'Student',
  })
  createdId = r.data?.data?.id
  check('4. POST /users: создание → 200', r.status === 200 && !!createdId)
  check('5. ответ без хеша пароля', r.data?.data && !('password' in r.data.data))
  check('6. СНИЛС нормализован до 11 цифр', r.data?.data?.snils === SNILS, r.data?.data?.snils)

  // 7-9. Уникальность login/email/snils → 400
  r = await call('POST', '/api/users', { name: 'X', login: LOGIN, password: '123456', snils: '55555555555', email: 'x@test.local' })
  check('7. дубль login → 400', r.status === 400, r.data?.error || '')
  r = await call('POST', '/api/users', { name: 'X', login: 'adm_test2', password: '123456', snils: '55555555555', email: EMAIL })
  check('8. дубль email → 400', r.status === 400, r.data?.error || '')
  r = await call('POST', '/api/users', { name: 'X', login: 'adm_test3', password: '123456', snils: SNILS, email: 'x@test.local' })
  check('9. дубль snils → 400', r.status === 400, r.data?.error || '')

  // 10-13. Валидация
  r = await call('POST', '/api/users', { name: 'X', login: 'adm_bad', password: '123', snils: '55555555555' })
  check('10. пароль < 6 → 400', r.status === 400)
  r = await call('POST', '/api/users', { name: 'X', login: 'adm_bad', password: '123456', snils: '12345' })
  check('11. СНИЛС не 11 цифр → 400', r.status === 400)
  r = await call('POST', '/api/users', { name: 'X', login: 'adm_bad', password: '123456', snils: '55555555555', role: 'Superuser' })
  check('12. недопустимая роль → 400', r.status === 400, r.data?.error || '')
  r = await call('POST', '/api/users', { name: 'X', login: 'adm_bad', password: '123456', snils: '55555555555', email: 'not-an-email' })
  check('13. некорректная почта → 400', r.status === 400)

  // 14. Список содержит созданного
  r = await call('GET', '/api/users')
  const list = r.data?.data || []
  check('14. GET /users содержит созданного', r.status === 200 && list.some((u) => u.id === createdId))

  // 15-16. Редактирование полей
  r = await call('PUT', `/api/users/${createdId}`, {
    specialty: '09.02.07 Информационные системы',
    group_name: '8И-255',
    role: 'Teacher',
  })
  check('15. PUT: specialty/group/role → 200', r.status === 200
    && r.data?.data?.specialty === '09.02.07 Информационные системы'
    && r.data?.data?.group_name === '8И-255'
    && r.data?.data?.role === 'Teacher')

  // 17. Смена пароля: старый перестаёт работать, новый работает
  r = await call('PUT', `/api/users/${createdId}`, { password: NEW_PASS })
  check('17. PUT: смена пароля → 200', r.status === 200)
  r = await call('POST', '/api/auth/login', { login: LOGIN, password: OLD_PASS }, null)
  check('18. login старым паролем → 401', r.status === 401)
  r = await call('POST', '/api/auth/login', { login: LOGIN, password: NEW_PASS }, null)
  check('19. login новым паролем → 200', r.status === 200 && !!r.data?.token)

  // 20. PUT без пароля — пароль не меняется
  r = await call('PUT', `/api/users/${createdId}`, { name: 'Тест Админ 2' })
  check('20. PUT без пароля → 200', r.status === 200 && r.data?.data?.name === 'Тест Админ 2')
  r = await call('POST', '/api/auth/login', { login: LOGIN, password: NEW_PASS }, null)
  check('21. пароль прежний после PUT без пароля → 200', r.status === 200)

  // 22-25. Самозащита админа
  r = await call('PUT', '/api/users/1', { role: 'Student' })
  check('22. смена собственной роли → 400', r.status === 400, r.data?.error || '')
  r = await call('DELETE', '/api/users/1')
  check('23. удаление себя → 400', r.status === 400, r.data?.error || '')

  // 24-25. Несуществующие id
  r = await call('PUT', '/api/users/99999', { name: 'X' })
  check('24. PUT несуществующего → 404', r.status === 404)
  r = await call('DELETE', '/api/users/99999')
  check('25. DELETE несуществующего → 404', r.status === 404)

  // 26. Дубль email через PUT (23505 → 400)
  r = await call('GET', '/api/users')
  const roman = (r.data?.data || []).find((u) => u.id === 1)
  if (roman?.email) {
    r = await call('PUT', `/api/users/${createdId}`, { email: roman.email })
    check('26. PUT: дубль email → 400', r.status === 400, r.data?.error || '')
  } else {
    check('26. PUT: дубль email → 400 (пропущен, email Roman не задан)', false, 'нет email у id=1')
  }

  // 27-29. Удаление
  r = await call('DELETE', `/api/users/${createdId}`)
  check('27. DELETE пользователя → 200', r.status === 200)
  r = await call('GET', '/api/users')
  check('28. удалённого нет в списке', !(r.data?.data || []).some((u) => u.id === createdId))
  r = await call('POST', '/api/auth/login', { login: LOGIN, password: NEW_PASS }, null)
  check('29. login удалённого → 401', r.status === 401)

  console.log(`\nИтого: ${passed} PASS, ${failed} FAIL`)
  process.exitCode = failed === 0 ? 0 : 1
})().catch(async (e) => {
  console.error('ERR', e)
  process.exitCode = 1
}).finally(cleanup)
