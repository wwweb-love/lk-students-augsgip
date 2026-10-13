import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SettingsPage.css'
import './GradesPage.css'

// Цветовая индикация оценки: 5 — зелёный, 4 — синий, 3 — оранжевый, 2 — красный
const GRADE_CLASS = { 5: 'grade-5', 4: 'grade-4', 3: 'grade-3', 2: 'grade-2' }

// Оценка в ячейке: число 2..5 или «Зачёт»/«Незачёт»
function GradeBadge({ row }) {
  if (Number.isInteger(row.grade)) {
    return <span className={`grade-badge ${GRADE_CLASS[row.grade] || ''}`}>{row.grade}</span>
  }
  if (row.passed === true) return <span className="grade-badge grade-pass">Зачёт</span>
  if (row.passed === false) return <span className="grade-badge grade-fail">Незачёт</span>
  return <span className="muted">—</span>
}

// Журнал оценок (успеваемость) — GET /api/grades
export function GradesPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [grades, setGrades] = useState([])
  const [summary, setSummary] = useState(null)
  const [syncedAt, setSyncedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [semester, setSemester] = useState('all')

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }, [navigate])

  const fetchGrades = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/grades', {
        headers: authHeaders(),
        credentials: 'include',
      })
      if (res.status === 401) return handleUnauthorized()
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.error) {
        setError(body?.error || 'Ошибка загрузки журнала оценок')
        setGrades([])
        setSummary(null)
        return
      }
      setGrades(Array.isArray(body.data?.grades) ? body.data.grades : [])
      setSummary(body.data?.summary || null)
      setSyncedAt(body.data?.synced_at || null)
    } catch {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }, [authHeaders, handleUnauthorized])

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      navigate('/login')
      return
    }
    setUser(JSON.parse(savedUser))
    fetchGrades()
  }, [navigate, fetchGrades])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Семестры журнала — для фильтра (только те, где есть хотя бы одна оценка)
  const semesters = useMemo(() => {
    const set = new Set()
    for (const g of grades) {
      if (g.semester !== null && g.semester !== undefined) set.add(Number(g.semester))
    }
    return [...set].sort((a, b) => a - b)
  }, [grades])

  // Поиск по дисциплине + фильтр по семестру (сервер уже вернул журнал без фильтра —
  // сводка считается по всему журналу, поэтому фильтруем список только на клиенте)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return grades.filter((g) => {
      if (q && !String(g.discipline || '').toLowerCase().includes(q)) return false
      if (semester !== 'all' && Number(g.semester) !== Number(semester)) return false
      return true
    })
  }, [grades, query, semester])

  if (!user) return null

  const hasGrades = grades.length > 0

  return (
    <div className="settings-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={`settings-layout${sidebarCollapsed ? ' layout-collapsed' : ''}`}>
        <header className="settings-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="settings-brand">
            <div className="settings-logo">
              <img className="brand-logo" src="/image/logo.png" alt="Логотип Академии" />
            </div>
            <div>
              <p className="settings-kicker">СПб ГБПОУ «АУГСГиП»</p>
              <h1>Личный кабинет студента</h1>
            </div>
          </div>
          <div className="settings-actions">
            <span className="settings-email">
              <img className="user-avatar" src={avatarFor(user.role)} alt="" />
              {user.login}
            </span>
            <ThemeToggle />
            <button className="btn btn-ghost" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </header>

        <main className="settings-main grades-main">
          <div className="settings-content">
            <div className="page-head">
              <div>
                <p className="eyebrow">Личный кабинет</p>
                <h2>Успеваемость</h2>
                <p className="muted">
                  Группа {grades[0]?.group_name || user.group_name || '—'}
                </p>
              </div>
            </div>

            {loading && <p className="status">Загрузка журнала оценок…</p>}
            {error && <p className="status error">{error}</p>}

            {!loading && !error && !hasGrades && (
              <div className="settings-card">
                <p className="muted">
                  Оценок пока нет. Журнал заполняется автоматически при синхронизации с 1С —
                  данные появятся после ближайшей выгрузки.
                </p>
              </div>
            )}

            {!loading && !error && hasGrades && summary && (
              <>
                <div className="grades-summary">
                  <div className="settings-card grades-summary-card">
                    <h3>Средний балл</h3>
                    <p className="grades-average">
                      {summary.average ?? '—'}
                    </p>
                    <p className="muted">{summary.numeric} оценок по 5-балльной шкале</p>
                  </div>

                  <div className="settings-card grades-summary-card">
                    <h3>Зачёты</h3>
                    <p className="grades-average">{summary.passed}</p>
                    <p className="muted">
                      незачётов: {summary.failed}
                    </p>
                  </div>

                  <div className="settings-card grades-summary-card">
                    <h3>Всего записей</h3>
                    <p className="grades-average">{summary.total}</p>
                    <p className="muted">в журнале</p>
                  </div>

                  <div className="settings-card grades-summary-card grades-dist">
                    <h3>Распределение</h3>
                    <div className="grades-dist-rows">
                      {[5, 4, 3, 2].map((n) => {
                        // Доля оценки среди 5-балльных (numeric может быть 0 — все зачёты)
                        const count = summary.distribution?.[n] || 0
                        const percent = summary.numeric
                          ? Math.round((count / summary.numeric) * 100)
                          : 0
                        return (
                          <div key={n} className="grades-dist-row">
                            <span className={`grade-badge ${GRADE_CLASS[n]}`}>{n}</span>
                            <div className="grades-dist-bar">
                              <div
                                className={`grades-dist-fill ${GRADE_CLASS[n]}`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="grades-dist-count">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="curriculum-toolbar">
                    <h3>Журнал оценок ({visible.length})</h3>
                    <div className="curriculum-filters">
                      <input
                        type="search"
                        placeholder="Поиск дисциплины…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Поиск дисциплины"
                      />
                      {semesters.length > 0 && (
                        <select
                          value={semester}
                          onChange={(e) => setSemester(e.target.value)}
                          aria-label="Семестр"
                        >
                          <option value="all">Все семестры</option>
                          {semesters.map((n) => (
                            <option key={n} value={n}>
                              {n} семестр
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {visible.length === 0 ? (
                    <p className="muted">По вашему запросу оценки не найдены.</p>
                  ) : (
                    <div className="curriculum-table-wrap">
                      <table className="curriculum-table grades-table">
                        <thead>
                          <tr>
                            <th>Дисциплина</th>
                            <th>Семестр</th>
                            <th>Вид работы</th>
                            <th>Дата</th>
                            <th className="num">Оценка</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((g) => (
                            <tr key={g.id}>
                              <td className="curriculum-name">{g.discipline}</td>
                              <td>{g.semester ?? '—'}</td>
                              <td>{g.work_type || '—'}</td>
                              <td>
                                {g.date
                                  ? new Date(g.date).toLocaleDateString('ru-RU')
                                  : '—'}
                              </td>
                              <td className="num">
                                <GradeBadge row={g} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {syncedAt && (
                  <p className="muted curriculum-sync">
                    Данные успеваемости загружены {new Date(syncedAt).toLocaleDateString('ru-RU')}
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
