import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        localStorage.setItem('user', JSON.stringify(data.data))
        if (data.token) {
          localStorage.setItem('token', data.token)
        }
        navigate('/')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero hero-centered">
        <div className="auth-hero-content">
          <div className="auth-logo">
            <img className="brand-logo" src="/image/logo.png" alt="Логотип Академии" />
          </div>
          <p className="brand-kicker">Санкт-Петербургское государственное бюджетное профессиональное образовательное учреждение</p>
          <h1>«Академия управления городской средой, градостроительства и печати»</h1>
          <p className="auth-tagline">Качественное среднее профессиональное образование</p>
        </div>
      </div>
      <div className="auth-form-section">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Вход в личный кабинет</h2>
          {error ? <p className="alert error">{error}</p> : null}
          <label>
            Логин
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Вход…' : 'Войти'}
          </button>
          <div className="auth-links">
            <Link to="/register">Регистрация</Link>
            <Link to="/initial_password">Забыл пароль</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
