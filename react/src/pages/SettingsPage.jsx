import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SettingsPage.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Смена пароля через ссылку на почту (пользователь уже авторизован)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetNotice, setResetNotice] = useState(null) // { type: 'success' | 'error', text }

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      navigate('/login')
      return
    }
    setUser(JSON.parse(savedUser))
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Отправляет ссылку для смены пароля на почту — пользователь определяется по токену сессии
  const handleResetLink = async () => {
    setResetLoading(true)
    setResetNotice(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/auth/reset-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const data = await response.json().catch(() => null)

      if (response.status === 401) {
        // Сессия истекла — отправляем на вход
        localStorage.removeItem('user')
        localStorage.removeItem('token')
        navigate('/login')
        return
      }

      if (data?.error) {
        setResetNotice({ type: 'error', text: data.error })
      } else {
        setResetNotice({
          type: 'success',
          text: data?.message || 'Ссылка для сброса пароля отправлена на вашу почту',
        })
      }
    } catch (err) {
      setResetNotice({ type: 'error', text: 'Ошибка подключения к серверу' })
    } finally {
      setResetLoading(false)
    }
  }

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

        <main className="settings-main">
          <div className="settings-content">
            <div className="page-head">
              <div>
                <p className="eyebrow">Личный кабинет</p>
                <h2>Настройки</h2>
              </div>
            </div>

            <div className="settings-card">
              <h3>Уведомления</h3>
              <p className="muted">Управление уведомлениями и рассылкой</p>
              <div className="settings-option">
                <label className="toggle-label">
                  <span>Email-уведомления</span>
                  <input type="checkbox" defaultChecked />
                </label>
              </div>
              <div className="settings-option">
                <label className="toggle-label">
                  <span>Push-уведомления</span>
                  <input type="checkbox" />
                </label>
              </div>
            </div>

            <div className="settings-card">
              <h3>Безопасность</h3>
              <p className="muted">
                Отправим ссылку для смены пароля на вашу почту — она действительна 5 минут
              </p>
              {resetNotice && (
                <p className={`alert ${resetNotice.type}`}>{resetNotice.text}</p>
              )}
              <button
                className="btn btn-ghost"
                onClick={handleResetLink}
                disabled={resetLoading}
              >
                {resetLoading ? 'Отправка…' : 'Сменить пароль'}
              </button>
            </div>

            <div className="settings-card">
              <h3>Аккаунт</h3>
              <p className="muted">Управление аккаунтом</p>
              <button className="btn btn-danger" onClick={handleLogout}>
                Выйти из аккаунта
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
