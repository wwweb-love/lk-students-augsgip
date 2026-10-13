// Тест уникальности students: login/email/snils — npm run test:unique
// Создаёт временных кандидатов в students_1c и записи в students, затем удаляет.
const bcrypt = require('bcrypt')
const { pool } = require('../db/pool')

const BASE = 'http://127.0.0.1:3000'
const CAND1 = '77777777777' // кандидат 1 (успешная регистрация)
const CAND2 = '77777777778' // кандидат 2 (занятая почта)
const CAND3 = '77777777779' // кандидат 3 (занятый логин)

let passed = 0
let failed = 0
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${extra ? ` — ${extra}` : ''}`)
  cond ? passed++ : failed++
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function cleanup() {
  try {
    await pool.query(
      `DELETE FROM students WHERE login LIKE 'uniq_%' OR snils IN ($1, $2, $3)`,
      [CAND1, CAND2, CAND3]
    )
    await pool.query(
      `DELETE FROM students_1c WHERE snils IN ($1, $2, $3)`,
      [CAND1, CAND2, CAND3]
    )
    console.log('\nВременные данные удалены')
  } catch (e) {
    console.error('cleanup ERR', e.message)
  }
  await pool.end()
}

async function addCandidate(snils) {
  await pool.query(
    `INSERT INTO students_1c (name, specialty, group_name, snils)
     VALUES ('Тест Уникальность', 'x', '9С-254', $1)`,
    [snils]
  )
}

async function expectDbError(queryText, params) {
  try {
    await pool.query(queryText, params)
    return null
  } catch (e) {
    return e
  }
}

;(async () => {
  // 0. Временные кандидаты для API-регистрации
  await addCandidate(CAND1)
  await addCandidate(CAND2)
  await addCandidate(CAND3)
  const hash = await bcrypt.hash('Pass1234', 10)

  // 1. Успешная регистрация (новые login/email/snils; СНИЛС с дефисами — нормализация)
  let r = await call('POST', '/api/auth/register', {
    snils: '777-777-777 77', login: 'uniq_test1', password: 'Pass1234', email: 'uniq_test1@test.local',
  })
  check('1. register: свободные значения (СНИЛС с дефисами) → 200', r.status === 200 && r.data.error === null)

  // 2. Повторная регистрация того же СНИЛС → 400
  r = await call('POST', '/api/auth/register', {
    snils: CAND1, login: 'uniq_test1b', password: 'Pass1234', email: 'uniq_test1b@test.local',
  })
  check('2. register: тот же СНИЛС повторно → 400', r.status === 400, r.data?.error || '')

  // 3. Занятая почта → 400
  r = await call('POST', '/api/auth/register', {
    snils: CAND2, login: 'uniq_test2', password: 'Pass1234', email: 'uniq_test1@test.local',
  })
  check('3. register: занятая почта → 400', r.status === 400, r.data?.error || '')

  // 4. Занятый логин → 400
  r = await call('POST', '/api/auth/register', {
    snils: CAND3, login: 'uniq_test1', password: 'Pass1234', email: 'uniq_test3@test.local',
  })
  check('4. register: занятый логин → 400', r.status === 400, r.data?.error || '')

  // 5. Прямое нарушение UNIQUE в БД (страховка на уровне таблицы)
  let err = await expectDbError(
    `INSERT INTO students (name, login, password, email, snils, role)
     VALUES ('X', 'uniq_test1', 'x', 'dupe@test.local', '70000000001', 'Student')`
  )
  check('5. INSERT дубля login → 23505', err?.code === '23505', err?.constraint || '')

  err = await expectDbError(
    `INSERT INTO students (name, login, password, email, snils, role)
     VALUES ('X', 'uniq_dupe2', 'x', 'uniq_test1@test.local', '70000000002', 'Student')`
  )
  check('6. INSERT дубля email → 23505', err?.code === '23505', err?.constraint || '')

  err = await expectDbError(
    `INSERT INTO students (name, login, password, email, snils, role)
     VALUES ('X', 'uniq_dupe3', 'x', 'uniq_dupe3@test.local', $1, 'Student')`,
    [CAND1]
  )
  check('7. INSERT дубля snils → 23505', err?.code === '23505', err?.constraint || '')

  // 8. Несколько NULL-почт не конфликтуют
  err = await expectDbError(
    `INSERT INTO students (name, login, password, email, snils, role)
     VALUES ('X', 'uniq_null1', 'x', NULL, '70000000004', 'Student'),
            ('X', 'uniq_null2', 'x', NULL, '70000000005', 'Student')`
  )
  check('8. две NULL-почты → разрешены', err === null, err?.message || '')

  console.log(`\nИтого: ${passed} PASS, ${failed} FAIL`)
  process.exitCode = failed === 0 ? 0 : 1
})().catch(async (e) => {
  console.error('ERR', e)
  process.exitCode = 1
}).finally(cleanup)
