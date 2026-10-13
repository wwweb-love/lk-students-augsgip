import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './LoginPage.css'
import './InitialPasswordPage.css'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [status, setStatus] = useState('checking') // checking | valid | invalid
  const [maskedEmail, setMaskedEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Проверяем ссылку при открытии страницы
  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    fetch(`/api/auth/reset-password/${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => {
        if (data.error) {
          setStatus('invalid')
        } else {
          setMaskedEmail(data.data?.email || '')
          setStatus('valid')
        }
      }))
      .catch(() => setStatus('invalid'))
  }, [token])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setStatus('invalid')
      } else {
        setDone(true)
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
          <h2>Новый пароль</h2>

          {status === 'checking' && (
            <p className="reset-checking">Проверяем ссылку…</p>
          )}

          {status === 'invalid' && (
            <>
              <p className="alert error">
                Ссылка недействительна или истекла. Ссылка действительна в течение
                5 минут с момента отправки.
              </p>
              <Link className="btn btn-primary reset-submit" to="/initial_password">
                Запросить новую ссылку
              </Link>
            </>
          )}

          {status === 'valid' && done && (
            <div className="reset-done">
              <p className="alert success">Пароль успешно обновлён.</p>
              {error ? <p className="alert error">{error}</p> : null}
              <Link className="btn btn-primary reset-submit" to="/login">
                Войти с новым паролем
              </Link>
            </div>
          )}

          {status === 'valid' && !done && (
            <>
              <p className="hint">
                Укажите новый пароль для учётной записи{maskedEmail ? ` (${maskedEmail})` : ''}.
                Пароль изменится только после сохранения на этой странице.
              </p>
              {error ? <p className="alert error">{error}</p> : null}
              <form onSubmit={onSubmit}>
                <label>
                  Новый пароль
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </label>
                <label>
                  Повторите пароль
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </label>
                <button className="btn btn-primary reset-submit" type="submit" disabled={loading}>
                  {loading ? 'Сохранение…' : 'Сохранить новый пароль'}
                </button>
              </form>
            </>
          )}

          <div className="auth-links">
            <Link to="/login">← Вернуться ко входу</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
