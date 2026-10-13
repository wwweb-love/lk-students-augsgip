const { pool } = require('../db/pool')

// Сводка для админ-дашборда
async function getStats(client = pool) {
  const [today, active, week, roles, reg] = await Promise.all([
    // входы сегодня: всего и уникальных пользователей
    client.query(
      `SELECT COUNT(*)::int AS logins,
              COUNT(DISTINCT user_id)::int AS users
       FROM sessions
       WHERE created_at >= date_trunc('day', now())`
    ),

    // активные сессии «сейчас»: не завершены и были активны за 15 минут
    client.query(
      `SELECT COUNT(*)::int AS sessions,
              COUNT(DISTINCT user_id)::int AS users
       FROM sessions
       WHERE ended_at IS NULL AND last_seen > now() - interval '15 minutes'`
    ),

    // входы за последние 7 дней (для графика; всегда 7 строк, пустые дни = 0)
    client.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day,
              COUNT(s.id)::int AS logins,
              COUNT(DISTINCT s.user_id)::int AS users
       FROM generate_series(
         date_trunc('day', now()) - interval '6 days',
         date_trunc('day', now()),
         interval '1 day'
       ) d
       LEFT JOIN sessions s ON s.created_at >= d AND s.created_at < d + interval '1 day'
       GROUP BY d
       ORDER BY d`
    ),

    // пользователи по ролям
    client.query(
      `SELECT COALESCE(role, 'Student') AS role, COUNT(*)::int AS count
       FROM students
       GROUP BY 1
       ORDER BY 1`
    ),

    // регистрации за 7 дней (старые записи без created_at не учитываются)
    client.query(
      `SELECT COUNT(*)::int AS count FROM students
       WHERE created_at >= now() - interval '7 days'`
    ),
  ])

  const roleCounts = {}
  for (const row of roles.rows) roleCounts[row.role] = row.count
  const totalUsers = roles.rows.reduce((sum, r) => sum + r.count, 0)

  return {
    todayLogins: today.rows[0].logins,      // входов сегодня
    todayUsers: today.rows[0].users,        // уникальных студентов/пользователей сегодня
    activeSessions: active.rows[0].sessions, // сессий «онлайн» сейчас
    activeUsers: active.rows[0].users,       // уникальных людей онлайн
    logins7d: week.rows,                    // [{ day, logins, users }] × 7
    roles: roleCounts,                      // { Admin, Teacher, Student, Guest }
    totalUsers,
    registrationsWeek: reg.rows[0].count,    // новых за 7 дней
  }
}

module.exports = { getStats }
