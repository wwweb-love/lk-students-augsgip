import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './RegisterPage.css'

const initial = {
  snils: '',
  login: '',
  email: '',
  password: '',
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
          <h2>Регистрация аккаунта</h2>
          <p className="hint">
            Регистрация доступна только студентам, уже внесённым в базу. Укажите СНИЛС, логин, email и пароль.
          </p>
          {error ? <p className="alert error">{error}</p> : null}
          <label>
            СНИЛС
            <input
              name="snils"
              value={form.snils}
              onChange={onChange}
              placeholder="000-000-000 00"
              required
            />
          </label>
          <label>
            Логин
            <input
              name="login"
              value={form.login}
              onChange={onChange}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              autoComplete="email"
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={onChange}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Сохранение…' : 'Зарегистрироваться'}
          </button>
          <div className="auth-links">
            <Link to="/login">Уже есть аккаунт</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
