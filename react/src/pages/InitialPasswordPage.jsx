import { useState } from 'react'
import { Link } from 'react-router-dom'
import './LoginPage.css'
import './InitialPasswordPage.css'

export function InitialPasswordPage() {
  const [snils, setSnils] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snils }),
      })
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSent(true)
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
        <div className="auth-card">
          <h2>Восстановление пароля</h2>

          {!sent ? (
            <>
              <p className="hint">
                Укажите свой СНИЛС — по нему мы найдём вашу учётную запись и отправим
                ссылку для сброса пароля на почту, указанную при регистрации.
                Ссылка действительна в течение 5 минут.
              </p>
              {error ? <p className="alert error">{error}</p> : null}
              <form onSubmit={onSubmit}>
                <label>
                  СНИЛС
                  <input
                    name="snils"
                    value={snils}
                    onChange={(e) => setSnils(e.target.value)}
                    placeholder="000-000-000 00"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                  />
                </label>
                <button className="btn btn-primary reset-submit" type="submit" disabled={loading}>
                  {loading ? 'Отправка…' : 'Отправить ссылку сброса пароля на почту'}
                </button>
              </form>
            </>
          ) : (
            <div className="reset-sent">
              <p className="alert success">
                Ссылка для сброса пароля отправлена на почту, указанную при
                регистрации учётной записи.
              </p>
              <p className="hint">
                Проверьте входящие письма и папку «Спам». Ссылка действительна в
                течение 5 минут.
              </p>
              <button className="btn btn-ghost" onClick={() => setSent(false)}>
                Отправить ещё раз
              </button>
            </div>
          )}

          <div className="auth-links">
            <Link to="/login">← Вернуться ко входу</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
