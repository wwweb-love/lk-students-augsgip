import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './ProfilePage.css'

export function ProfilePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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

  if (!user) return null

  return (
    <div className="profile-page">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className={`profile-layout${sidebarCollapsed ? ' layout-collapsed' : ''}`}>
        <header className="profile-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="profile-brand">
            <div className="profile-logo">
              <img className="brand-logo" src="/image/logo.png" alt="Логотип Академии" />
            </div>
            <div>
              <p className="profile-kicker">СПб ГБПОУ «АУГСГиП»</p>
              <h1>Личный кабинет студента</h1>
            </div>
          </div>
          <div className="profile-actions">
            <span className="profile-email">
              <img className="user-avatar" src={avatarFor(user.role)} alt="" />
              {user.login}
            </span>
            <ThemeToggle />
            <button className="btn btn-ghost" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </header>

        <main className="profile-main">
          <div className="profile-content">
            <div className="page-head">
              <div>
                <p className="eyebrow">Личный кабинет</p>
                <h2>Профиль студента</h2>
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-avatar">
                <img src={avatarFor(user.role)} alt="Аватар" />
              </div>
              <div className="profile-info">
                <h3>{user.login}</h3>
                <p className="muted">{user.email}</p>
              </div>
            </div>

            <div className="profile-details">
              <div className="profile-row">
                <span className="profile-label">Логин</span>
                <span className="profile-value">{user.login}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Email</span>
                <span className="profile-value">{user.email}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Группа</span>
                <span className="profile-value">{user.group_name || '—'}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Специальность</span>
                <span className="profile-value">{user.specialty || '—'}</span>
              </div>
            </div>

            <button className="btn btn-ghost" onClick={handleLogout}>
              Выйти из аккаунта
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
