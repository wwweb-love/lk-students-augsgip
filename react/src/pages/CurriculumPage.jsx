import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SettingsPage.css'
import './CurriculumPage.css'

// «3 Семестр» / «1 семестр» → 3 / 1 (в выгрузке из 1С регистр разный)
function semesterNumber(semester) {
  const n = parseInt(String(semester || '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// Учебный план группы текущего пользователя (GET /api/curriculum)
export function CurriculumPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [plan, setPlan] = useState(null)
  const [disciplines, setDisciplines] = useState([])
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

  const fetchCurriculum = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/curriculum', {
        headers: authHeaders(),
        credentials: 'include',
      })
      if (res.status === 401) return handleUnauthorized()
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.error) {
        setError(body?.error || 'Ошибка загрузки учебного плана')
        setPlan(null)
        setDisciplines([])
        return
      }
      setPlan(body.data?.plan || null)
      setDisciplines(Array.isArray(body.data?.disciplines) ? body.data.disciplines : [])
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
    fetchCurriculum()
  }, [navigate, fetchCurriculum])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Все семестры плана — для фильтра (только те, где есть хотя бы одна дисциплина)
  const semesters = useMemo(() => {
    const set = new Set()
    for (const d of disciplines) {
      for (const s of d.by_semester || []) {
        const n = semesterNumber(s.semester)
        if (n) set.add(n)
      }
    }
    return [...set].sort((a, b) => a - b)
  }, [disciplines])

  // Поиск по названию + фильтр по семестру
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return disciplines.filter((d) => {
      if (q && !String(d.name || '').toLowerCase().includes(q)) return false
      if (semester !== 'all') {
        const has = (d.by_semester || []).some(
          (s) => semesterNumber(s.semester) === Number(semester)
        )
        if (!has) return false
      }
      return true
    })
  }, [disciplines, query, semester])

  // Итоги по отфильтрованному списку (строки-итоги из 1С уже отброшены сервером)
  const totals = useMemo(
    () =>
      visible.reduce(
        (acc, d) => ({
          total: acc.total + (Number(d.total_hours) || 0),
          lab: acc.lab + (Number(d.lab_hours) || 0),
          practice: acc.practice + (Number(d.practice_hours) || 0),
          self: acc.self + (Number(d.self_hours) || 0),
        }),
        { total: 0, lab: 0, practice: 0, self: 0 }
      ),
    [visible]
  )

  if (!user) return null

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

        <main className="settings-main curriculum-main">
          <div className="settings-content">
            <div className="page-head">
              <div>
                <p className="eyebrow">Личный кабинет</p>
                <h2>Учебный план</h2>
                <p className="muted">
                  Группа {plan?.group_name || user.group_name || '—'}
                  {plan ? ` · ${plan.specialty}` : ''}
                </p>
              </div>
            </div>

            {loading && <p className="status">Загрузка учебного плана…</p>}
            {error && <p className="status error">{error}</p>}

            {!loading && !error && plan && (
              <>
                <div className="settings-card">
                  <h3>Данные плана</h3>
                  <dl className="curriculum-meta">
                    <div>
                      <dt>Специальность</dt>
                      <dd>{plan.specialty || '—'}</dd>
                    </div>
                    <div>
                      <dt>Квалификация</dt>
                      <dd>{plan.qualification || '—'}</dd>
                    </div>
                    <div>
                      <dt>Форма обучения</dt>
                      <dd>{plan.form || '—'}</dd>
                    </div>
                    <div>
                      <dt>Курс</dt>
                      <dd>{plan.course || '—'}</dd>
                    </div>
                    <div>
                      <dt>Год набора</dt>
                      <dd>{plan.admission_year || '—'}</dd>
                    </div>
                    <div>
                      <dt>Срок обучения</dt>
                      <dd>{plan.duration_years ? `${plan.duration_years} год(а)` : '—'}</dd>
                    </div>
                    <div className="curriculum-meta-wide">
                      <dt>Учебный план</dt>
                      <dd>
                        {plan.plan_name || '—'}
                        {plan.plan_code ? ` · код ${plan.plan_code}` : ''}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="settings-card">
                  <div className="curriculum-toolbar">
                    <h3>Дисциплины ({visible.length})</h3>
                    <div className="curriculum-filters">
                      <input
                        type="search"
                        placeholder="Поиск дисциплины…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Поиск дисциплины"
                      />
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
                    </div>
                  </div>

                  {visible.length === 0 ? (
                    <p className="muted">По вашему запросу дисциплины не найдены.</p>
                  ) : (
                    <div className="curriculum-table-wrap">
                      <table className="curriculum-table">
                        <thead>
                          <tr>
                            <th>Дисциплина</th>
                            <th>Семестр</th>
                            <th className="num">Всего часов</th>
                            <th className="num">Лаб.</th>
                            <th className="num">Практика</th>
                            <th className="num">Самост.</th>
                            <th>Форма контроля</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((d, i) => {
                            const rows = (d.by_semester || []).filter(
                              (s) => semester === 'all' || semesterNumber(s.semester) === Number(semester)
                            )
                            const forms = [
                              ...new Set(rows.map((s) => s.control_form?.trim()).filter(Boolean)),
                            ]
                            return (
                              <tr key={`${d.name}-${i}`}>
                                <td className="curriculum-name">
                                  {d.name}
                                  {d.is_practice && <span className="chip chip-practice">практика</span>}
                                </td>
                                <td>
                                  {rows.map((s, j) => (
                                    <span key={j} className="chip curriculum-sem">
                                      {semesterNumber(s.semester) || s.semester}
                                    </span>
                                  ))}
                                </td>
                                <td className="num">{Number(d.total_hours) || 0}</td>
                                <td className="num">{Number(d.lab_hours) || 0}</td>
                                <td className="num">{Number(d.practice_hours) || 0}</td>
                                <td className="num">{Number(d.self_hours) || 0}</td>
                                <td className="curriculum-forms">
                                  {forms.length ? forms.join(', ') : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>Итого</td>
                            <td></td>
                            <td className="num">{totals.total}</td>
                            <td className="num">{totals.lab}</td>
                            <td className="num">{totals.practice}</td>
                            <td className="num">{totals.self}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <p className="muted curriculum-sync">
                  Данные учебного плана загружены {new Date(plan.synced_at).toLocaleDateString('ru-RU')}
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
