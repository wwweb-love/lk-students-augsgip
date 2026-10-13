import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SettingsPage.css'
import './CertificatePage.css'

// Справка об обучении — обычная страница меню.
// Кнопки получения — заглушки (disabled), заработают с разделом «Документы».
export function CertificatePage() {
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
                <h2>Справка об обучении</h2>
                <p className="muted">Оформление справки для предоставления по месту требования</p>
              </div>
            </div>

            <div className="settings-card">
              <h3>Что такое справка</h3>
              <p className="muted">
                Справка об обучении подтверждает, что вы являетесь студентом
                СПб ГБПОУ «АУГСГиП» и обучаетесь по программе среднего
                профессионального образования. В справке указываются ФИО,
                группа, специальность и период обучения. Документ можно
                предоставить по месту требования: в военкомат, на работу
                или в другое учебное заведение.
              </p>
            </div>

            <div className="settings-card">
              <h3>Как получить</h3>
              <p className="muted">
                Справка формируется в течение рабочего дня. Электронная версия
                будет добавлена в раздел «Документы» на сайте Личного кабинета
                студента, бумажную можно будет забрать в учебной части академии.
              </p>
              <div className="certificate-actions">
                <button className="btn btn-ghost" type="button" disabled>
                  Получить в бумажном виде
                </button>
                <button className="btn btn-ghost" type="button" disabled>
                  Получить в электронном виде
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
