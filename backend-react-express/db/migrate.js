// Раннер миграций: npm run migrate (применяет db/migrations/*.sql по порядку)
const fs = require('fs')
const path = require('path')
const { pool } = require('./pool')

const dir = path.join(__dirname, 'migrations')

;(async () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    console.log(`▶ ${file}`)
    await pool.query(sql)
    console.log(`✅ ${file} применена`)
  }

  const check = await pool.query('SELECT id, login, role FROM students ORDER BY id')
  console.log(JSON.stringify(check.rows, null, 1))
  process.exit(0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
