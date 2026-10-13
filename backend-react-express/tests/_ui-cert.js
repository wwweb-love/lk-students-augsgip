// node tests/_ui-cert.js create|delete — временный пользователь для проверки страницы «Справка об обучении»
const bcrypt = require('bcrypt')
const { pool } = require('../db/pool')

const cmd = process.argv[2]

;(async () => {
  if (cmd === 'create') {
    await pool.query('DELETE FROM students WHERE login = $1', ['cert_t'])
    const hash = await bcrypt.hash('Cert12345', 10)
    const r = await pool.query(
      `INSERT INTO students (name, specialty, group_name, login, password, email, snils, role)
       VALUES ('Тест Справки', NULL, NULL, 'cert_t', $1, 'cert_t@test.local', '77777777773', 'Student')
       RETURNING id`,
      [hash]
    )
    console.log('создан cert_t id=' + r.rows[0].id)
  } else if (cmd === 'delete') {
    const r = await pool.query('DELETE FROM students WHERE login = $1', ['cert_t'])
    console.log('удалено:', r.rowCount)
  }
  process.exit(0)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
