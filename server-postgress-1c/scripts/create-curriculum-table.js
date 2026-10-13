const fs = require('fs');
require('dotenv').config();
const { Pool } = require('pg');
const sql = fs.readFileSync(require('path').join(__dirname, '..', 'sql', 'curriculum_1c.sql'), 'utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  await pool.query(sql);
  const r = await pool.query("select column_name, data_type, is_nullable from information_schema.columns where table_name = 'curriculum_1c' order by ordinal_position");
  console.log('curriculum_1c columns:');
  r.rows.forEach(c => console.log('  ', c.column_name, '|', c.data_type, '| null=' + c.is_nullable));
  await pool.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
