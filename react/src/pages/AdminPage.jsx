import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SchedulePage.css'
import './AdminPage.css'

const ROLES = ['Admin', 'Teacher', 'Student', 'Guest']

const emptyForm = {
  name: '',
  specialty: '',
  group_name: '',
  login: '',
  password: '',
  email: '',
  snils: '',
  role: 'Student',
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function AdminPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  // null | { mode: 'create' } | { mode: 'edit', user } | { mode: 'delete', user }
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Вкладки админки: 'users' | 'analytics'
  const [tab, setTab] = useState('users')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users', { headers: authHeaders() })
      if (res.status === 401) {
        navigate('/login')
        return
      }
      const data = await res.json()
      if (data.error) setError(data.error)
      else setUsers(data.data || [])
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const res = await fetch('/api/stats', { headers: authHeaders() })
      if (res.status === 401) {
        navigate('/login')
        return
      }
      const data = await res.json()
      if (data.error) setStatsError(data.error)
      else setStats(data.data)
    } catch (err) {
      setStatsError('Ошибка подключения к серверу')
    } finally {
      setStatsLoading(false)
    }
  }, [navigate])

  const switchTab = (next) => {
    setTab(next)
    if (next === 'analytics') fetchStats()
  }

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) {
      navigate('/login')
      return
    }
    const parsed = JSON.parse(saved)
    setUser(parsed)
    if (parsed.role === 'Admin') fetchUsers()
    else setLoading(false)
  }, [navigate, fetchUsers])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  const flash = (message) => {
    setStatus(message)
    setTimeout(() => setStatus(''), 3000)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setModal({ mode: 'create' })
  }

  const openEdit = (u) => {
    setForm({
      name: u.name || '',
      specialty: u.specialty || '',
      group_name: u.group_name || '',
      login: u.login || '',
      password: '', // пусто = не менять
      email: u.email || '',
      snils: u.snils || '',
      role: u.role || 'Student',
    })
    setFormError('')
    setModal({ mode: 'edit', user: u })
  }

  const openDelete = (u) => {
    setFormError('')
    setModal({ mode: 'delete', user: u })
  }

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  }

  const onSubmitForm = async (event) => {
    event.preventDefault()
    const isEdit = modal.mode === 'edit'
    setSaving(true)
    setFormError('')

    try {
      const body = { ...form }
      if (isEdit && !body.password) delete body.password // не менять пароль
      if (isEdit && body.email === '') body.email = null // очистить почту

      const res = await fetch(isEdit ? `/api/users/${modal.user.id}` : '/api/users', {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        navigate('/login')
        return
      }
      const data = await res.json()
      if (data.error) {
        setFormError(data.error)
        return
      }
      setModal(null)
      flash(isEdit ? 'Изменения сохранены' : 'Пользователь создан')
      fetchUsers()
    } catch (err) {
      setFormError('Ошибка подключения к серверу')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch(`/api/users/${modal.user.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.status === 401) {
        navigate('/login')
        return
      }
      const data = await res.json()
      if (data.error) {
        setFormError(data.error)
        return
      }
      setModal(null)
      flash('Пользователь удалён')
      fetchUsers()
    } catch (err) {
      setFormError('Ошибка подключения к серверу')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const isAdmin = user.role === 'Admin'

  return (
    <div className="schedule-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={`schedule-layout${sidebarCollapsed ? ' layout-collapsed' : ''}`}>
        <header className="schedule-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="schedule-brand">
            <div className="schedule-logo">
              <img className="brand-logo" src="/image/logo.png" alt="Логотип Академии" />
            </div>
            <div>
              <p className="schedule-kicker">СПб ГБПОУ «АУГСГиП»</p>
              <h1>Личный кабинет студента</h1>
            </div>
          </div>
          <div className="schedule-actions">
            <span className="schedule-email">
              <img className="user-avatar" src={avatarFor(user.role)} alt="" />
              {user.login}
            </span>
            <ThemeToggle />
            <button className="btn btn-ghost" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </header>

        <main className="schedule-main">
          <div className="schedule-content">
            {!isAdmin ? (
              <div className="access-denied">
                <h2>Доступ запрещён</h2>
                <p className="muted">Эта страница доступна только администратору.</p>
                <Link className="btn btn-primary" to="/">Перейти к расписанию</Link>
              </div>
            ) : (
              <>
                <div className="page-head">
                  <div>
                    <p className="eyebrow">Админ-панель</p>
                    <h2>{tab === 'users' ? 'Пользователи' : 'Аналитика'}</h2>
                    <p className="muted">
                      {tab === 'users'
                        ? 'Просмотр и управление учётными записями'
                        : 'Входы, активные сессии и состав пользователей'}
                    </p>
                  </div>
                  {tab === 'users' && (
                    <button className="btn btn-primary" onClick={openCreate}>
                      + Добавить пользователя
                    </button>
                  )}
                </div>

                <div className="admin-tabs">
                  <button
                    className={`admin-tab${tab === 'users' ? ' active' : ''}`}
                    onClick={() => switchTab('users')}
                  >
                    Пользователи
                  </button>
                  <button
                    className={`admin-tab${tab === 'analytics' ? ' active' : ''}`}
                    onClick={() => switchTab('analytics')}
                  >
                    Аналитика
                  </button>
                </div>

                {tab === 'analytics' && (
                  <div className="analytics">
                    {statsLoading && <p className="status">Загрузка статистики…</p>}
                    {statsError && <p className="status error">{statsError}</p>}
                    {!statsLoading && !statsError && stats && (
                      <>
                        <div className="stats-grid">
                          <div className="stat-card">
                            <span className="stat-label">Вошли сегодня</span>
                            <span className="stat-value">{stats.todayUsers}</span>
                            <span className="stat-sub">{stats.todayLogins} входов всего</span>
                          </div>
                          <div className="stat-card accent">
                            <span className="stat-label">Сейчас онлайн</span>
                            <span className="stat-value">{stats.activeSessions}</span>
                            <span className="stat-sub">активных сессий · {stats.activeUsers} чел.</span>
                          </div>
                          <div className="stat-card">
                            <span className="stat-label">Всего пользователей</span>
                            <span className="stat-value">{stats.totalUsers}</span>
                            <span className="stat-sub">учётных записей</span>
                          </div>
                          <div className="stat-card">
                            <span className="stat-label">Новые за неделю</span>
                            <span className="stat-value">{stats.registrationsWeek}</span>
                            <span className="stat-sub">регистраций</span>
                          </div>
                        </div>

                        <div className="analytics-row">
                          <div className="chart-card">
                            <div className="chart-head">
                              <h3>Входы за 7 дней</h3>
                              <button className="btn-mini" onClick={fetchStats}>Обновить</button>
                            </div>
                            <div className="bar-chart">
                              {(() => {
                                const max = Math.max(...stats.logins7d.map((x) => x.logins), 1)
                                return stats.logins7d.map((d) => {
                                  const [y, m, day] = d.day.split('-').map(Number)
                                  const label = new Date(y, m - 1, day)
                                    .toLocaleDateString('ru-RU', { weekday: 'short' })
                                  return (
                                    <div className="bar-col" key={d.day}>
                                      <span className="bar-value">{d.logins > 0 ? d.logins : ''}</span>
                                      <div
                                        className={`bar${d.logins === 0 ? ' empty' : ''}`}
                                        style={{ height: `${Math.max((d.logins / max) * 100, 3)}%` }}
                                        title={`${d.day}: ${d.logins} входов, ${d.users} чел.`}
                                      />
                                      <span className="bar-label">{label}</span>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          </div>

                          <div className="chart-card">
                            <h3>Пользователи по ролям</h3>
                            <div className="role-bars">
                              {ROLES.map((role) => {
                                const count = stats.roles[role] || 0
                                const max = Math.max(...ROLES.map((x) => stats.roles[x] || 0), 1)
                                return (
                                  <div className="role-bar-row" key={role}>
                                    <span className={`role-badge role-${role.toLowerCase()}`}>{role}</span>
                                    <div className="role-track">
                                      <div
                                        className={`role-fill fill-${role.toLowerCase()}`}
                                        style={{ width: `${Math.max((count / max) * 100, count > 0 ? 5 : 0)}%` }}
                                      />
                                    </div>
                                    <span className="role-count">{count}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {tab === 'users' && (
                  <>
                    {status && <p className="status success">{status}</p>}
                    {error && <p className="status error">{error}</p>}
                    {loading && <p className="status">Загрузка пользователей…</p>}

                {!loading && !error && (
                  <div className="table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>ФИО</th>
                          <th>Специальность</th>
                          <th>Группа</th>
                          <th>Логин</th>
                          <th>Email</th>
                          <th>СНИЛС</th>
                          <th>Роль</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 && (
                          <tr>
                            <td colSpan="9" className="empty-state">Пользователей нет</td>
                          </tr>
                        )}
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>
                              <div className="user-cell">
                                <img className="table-avatar" src={avatarFor(u.role)} alt="" />
                                <span>
                                  {u.name}
                                  {u.id === user.id && <span className="you-badge">вы</span>}
                                </span>
                              </div>
                            </td>
                            <td>{u.specialty || '—'}</td>
                            <td>{u.group_name || '—'}</td>
                            <td>{u.login}</td>
                            <td>{u.email || '—'}</td>
                            <td>{u.snils || '—'}</td>
                            <td>
                              <span className={`role-badge role-${(u.role || '').toLowerCase()}`}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button className="btn-mini" onClick={() => openEdit(u)}>
                                  Изменить
                                </button>
                                <button
                                  className="btn-mini danger"
                                  onClick={() => openDelete(u)}
                                  disabled={u.id === user.id}
                                  title={u.id === user.id ? 'Нельзя удалить себя' : ''}
                                >
                                  Удалить
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {modal && modal.mode !== 'delete' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={onSubmitForm}>
            <h3>{modal.mode === 'create' ? 'Новый пользователь' : `Редактирование: ${modal.user.login}`}</h3>
            {formError ? <p className="alert error">{formError}</p> : null}
            <div className="form-grid">
              <label className="full">
                ФИО
                <input name="name" value={form.name} onChange={onChange} required />
              </label>
              <label>
                Специальность
                <input name="specialty" value={form.specialty} onChange={onChange} />
              </label>
              <label>
                Группа
                <input name="group_name" value={form.group_name} onChange={onChange} />
              </label>
              <label>
                Логин
                <input name="login" value={form.login} onChange={onChange} autoComplete="off" required />
              </label>
              <label>
                {modal.mode === 'edit' ? 'Новый пароль' : 'Пароль'}
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  autoComplete="new-password"
                  minLength={modal.mode === 'edit' ? undefined : 6}
                  placeholder={modal.mode === 'edit' ? 'Пусто — не менять' : ''}
                  required={modal.mode === 'create'}
                />
              </label>
              <label>
                Email
                <input type="email" name="email" value={form.email} onChange={onChange} autoComplete="off" />
              </label>
              <label>
                СНИЛС
                <input name="snils" value={form.snils} onChange={onChange} placeholder="000-000-000 00" required />
              </label>
              <label>
                Роль
                <select
                  name="role"
                  value={form.role}
                  onChange={onChange}
                  disabled={modal.mode === 'edit' && modal.user.id === user.id}
                  title={modal.mode === 'edit' && modal.user.id === user.id ? 'Нельзя менять собственную роль' : ''}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Сохранение…' : modal.mode === 'create' ? 'Создать' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modal && modal.mode === 'delete' && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card modal-small" onClick={(e) => e.stopPropagation()}>
            <h3>Удалить пользователя?</h3>
            <p className="muted">
              Учётная запись <strong>{modal.user.login}</strong> ({modal.user.name}) будет
              удалена безвозвратно.
            </p>
            {formError ? <p className="alert error">{formError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)} disabled={saving}>
                Отмена
              </button>
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={saving}>
                {saving ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
