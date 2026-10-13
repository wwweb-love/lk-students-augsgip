import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SchedulePage.css'

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const MONTH_NAMES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateParam(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function formatDateDisplay(date) {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
}

function isSameWeek(date1, date2) {
  const monday1 = getMonday(date1)
  const monday2 = getMonday(date2)
  return monday1.getTime() === monday2.getTime()
}

export function SchedulePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [schedules, setSchedules] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      navigate('/login')
      return
    }
    setUser(JSON.parse(savedUser))
  }, [navigate])

  const fetchSchedules = useCallback((date) => {
    setLoading(true)
    setError('')
    const token = localStorage.getItem('token')
    
    fetch(`/api/schedules?date=${formatDateParam(date)}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      credentials: 'include',
    })
      .then((res) => {
        // Сессия недействительна (например, после ротации секрета) → на вход
        if (res.status === 401) {
          localStorage.removeItem('user')
          localStorage.removeItem('token')
          navigate('/login')
          throw new Error('unauthorized')
        }
        return res.json()
      })
      .then((data) => {
        if (data.error) {
          setError(data.error)
          setSchedules(null)
        } else {
          setSchedules(data.data)
        }
      })
      .catch(() => setError('Ошибка загрузки расписания'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user) {
      fetchSchedules(weekStart)
    }
  }, [user, weekStart, fetchSchedules])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  const goToPrevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const goToNextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const goToCurrentWeek = () => {
    setWeekStart(getMonday(new Date()))
  }

  if (!user) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const isCurrentWeek = isSameWeek(weekStart, today)

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
            <div className="page-head">
              <div>
                <p className="eyebrow">Главная</p>
                <h2>Расписание занятий</h2>
                <p className="muted">
                  Группа {user.group_name || '—'}
                </p>
              </div>
            </div>

            <div className="week-nav">
              <button className="btn btn-ghost week-nav-btn" onClick={goToPrevWeek} aria-label="Предыдущая неделя">
                <svg className="week-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span className="week-nav-text">← Предыдущая</span>
              </button>
              <div className="week-nav-info">
                <span className="week-nav-dates">
                  {formatDateDisplay(weekDays[0])} — {formatDateDisplay(weekDays[6])}
                </span>
                {!isCurrentWeek && (
                  <button className="btn btn-link" onClick={goToCurrentWeek}>
                    Текущая неделя
                  </button>
                )}
              </div>
              <button className="btn btn-ghost week-nav-btn" onClick={goToNextWeek} aria-label="Следующая неделя">
                <span className="week-nav-text">Следующая →</span>
                <svg className="week-nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            {loading && <p className="status">Загрузка данных…</p>}
            {error && <p className="status error">{error}</p>}

            {schedules && !loading && (
              <div className="week-grid">
                {weekDays.map((day, index) => {
                  const lessons = schedules[index] || []
                  const isToday = day.getTime() === today.getTime()
                  return (
                    <article key={index} className={`day-card${isToday ? ' is-today' : ''}`}>
                      <header>
                        <div>
                          <h3>{DAY_NAMES[index]}</h3>
                          <span className="day-date">{formatDateDisplay(day)}</span>
                        </div>
                        {isToday && <span className="chip orange">сегодня</span>}
                      </header>
                      {lessons.length ? (
                        lessons.map((lesson, i) => (
                          <div key={i} className="lesson-block">
                            <p className="time">{lesson.time_start?.slice(0, 5)} - {lesson.time_end?.slice(0, 5)}</p>
                            <p className="lesson-title">{lesson.subject}</p>
                            <p className="lesson-meta">
                              {lesson.teacher}
                              {lesson.room && ` · ауд. ${lesson.room}`}
                            </p>
                            <span className={`chip ${lesson.type === 'Лекции' ? 'chip-lecture' : 'chip-practice'}`}>
                              {lesson.type}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Нет занятий</p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
