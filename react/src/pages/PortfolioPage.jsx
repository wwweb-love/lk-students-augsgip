import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SettingsPage.css'
import './PortfolioPage.css'

// Общий лимит документов одного пользователя — 100 МБ
const MAX_BYTES = 100 * 1024 * 1024

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${bytes} Б`
}

function formatDate(iso) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

// Портфолио: загрузка, просмотр и удаление документов пользователя
export function PortfolioPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [docs, setDocs] = useState([])
  const [totalBytes, setTotalBytes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState(null) // { type: 'success' | 'error', text }
  const [selected, setSelected] = useState([]) // выбранные File[]
  const [uploading, setUploading] = useState(null) // { name, index, count, percent }
  const inputRef = useRef(null)

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }, [navigate])

  // Список документов + квота
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio', { headers: authHeaders() })
      if (res.status === 401) return handleUnauthorized()
      const body = await res.json().catch(() => null)
      if (body?.error) {
        setNotice({ type: 'error', text: body.error })
        return
      }
      setDocs(body?.data?.documents || [])
      setTotalBytes(body?.data?.totalBytes || 0)
    } catch {
      setNotice({ type: 'error', text: 'Ошибка подключения к серверу' })
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
    refresh()
  }, [navigate, refresh])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Выбор файлов: можно выбрать сразу несколько
  const handleSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length) setSelected((prev) => [...prev, ...files])
    e.target.value = '' // чтобы можно было выбрать тот же файл повторно
  }

  const handleUnselect = (index) => {
    setSelected((prev) => prev.filter((_, i) => i !== index))
  }

  // Загрузка одного файла сырым телом (XHR — ради прогресс-бара)
  const uploadOne = (file) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/portfolio?filename=${encodeURIComponent(file.name)}`)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      const token = localStorage.getItem('token')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100)
          setUploading((prev) => (prev ? { ...prev, percent } : prev))
        }
      }
      xhr.onload = () => {
        let body = null
        try {
          body = JSON.parse(xhr.responseText)
        } catch {
          /* ответ не JSON */
        }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(body)
        const err = new Error(body?.error || 'Ошибка загрузки')
        err.status = xhr.status
        reject(err)
      }
      xhr.onerror = () => reject(new Error('Ошибка соединения с сервером'))
      xhr.send(file)
    })

  const handleUpload = async () => {
    if (!selected.length || uploading) return

    // Проверка квоты до отправки — сразу показываем причину
    for (const f of selected) {
      if (f.size === 0) {
        setNotice({ type: 'error', text: `Файл «${f.name}» пустой` })
        return
      }
      if (f.size > MAX_BYTES) {
        setNotice({ type: 'error', text: `Файл «${f.name}» больше 100 МБ` })
        return
      }
    }
    const chosenTotal = selected.reduce((sum, f) => sum + f.size, 0)
    if (totalBytes + chosenTotal > MAX_BYTES) {
      setNotice({
        type: 'error',
        text: `Недостаточно места: выбрано ${formatSize(chosenTotal)}, свободно ${formatSize(
          Math.max(0, MAX_BYTES - totalBytes)
        )}. Удалите лишние документы`,
      })
      return
    }

    setNotice(null)
    try {
      for (let i = 0; i < selected.length; i++) {
        setUploading({ name: selected[i].name, index: i + 1, count: selected.length, percent: 0 })
        await uploadOne(selected[i])
      }
      setSelected([])
      if (inputRef.current) inputRef.current.value = ''
      setNotice({ type: 'success', text: 'Документы загружены' })
      await refresh()
    } catch (err) {
      if (err?.status === 401) return handleUnauthorized()
      setNotice({ type: 'error', text: err.message || 'Ошибка загрузки' })
      await refresh() // лимит мог измениться на сервере
    } finally {
      setUploading(null)
    }
  }

  // Скачивание: fetch c токеном → blob, чтобы работал и без cookie
  const handleDownload = async (doc) => {
    try {
      const res = await fetch(`/api/portfolio/${doc.id}`, { headers: authHeaders() })
      if (res.status === 401) return handleUnauthorized()
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setNotice({ type: 'error', text: body?.error || 'Документ не найден' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      setNotice({ type: 'error', text: 'Ошибка скачивания' })
    }
  }

  const handleDelete = async (doc) => {
    if (!window.confirm(`Удалить документ «${doc.filename}»?`)) return
    try {
      const res = await fetch(`/api/portfolio/${doc.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.status === 401) return handleUnauthorized()
      const body = await res.json().catch(() => null)
      if (body?.error) {
        setNotice({ type: 'error', text: body.error })
        return
      }
      setNotice({ type: 'success', text: 'Документ удалён' })
      await refresh()
    } catch {
      setNotice({ type: 'error', text: 'Ошибка подключения к серверу' })
    }
  }

  if (!user) return null

  const percent = Math.min(100, (totalBytes / MAX_BYTES) * 100)
  const selectedTotal = selected.reduce((sum, f) => sum + f.size, 0)

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
                <h2>Портфолио</h2>
                <p className="muted">Документы, сертификаты и награды — общий объём до 100 МБ</p>
              </div>
            </div>

            {notice && <p className={`alert ${notice.type}`}>{notice.text}</p>}

            <div className="settings-card">
              <h3>Загрузка документов</h3>
              <div className="pf-quota">
                <span>Использовано {formatSize(totalBytes)} из 100 МБ</span>
                <span className="pf-quota-left">
                  Свободно {formatSize(Math.max(0, MAX_BYTES - totalBytes))}
                </span>
              </div>
              <div className="pf-bar">
                <div className="pf-fill" style={{ width: `${percent}%` }} />
              </div>

              <input
                ref={inputRef}
                type="file"
                multiple
                className="pf-input"
                onChange={handleSelect}
              />
              <div className="pf-upload-row">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={!!uploading}
                >
                  Выбрать файлы
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleUpload}
                  disabled={!selected.length || !!uploading}
                >
                  {uploading
                    ? `Загрузка… ${uploading.percent}%`
                    : selected.length
                    ? `Загрузить (${selected.length})`
                    : 'Загрузить'}
                </button>
              </div>

              {selected.length > 0 && (
                <ul className="pf-selected">
                  {selected.map((f, i) => (
                    <li key={`${f.name}-${f.size}-${i}`}>
                      <span className="pf-sel-name">{f.name}</span>
                      <span className="pf-sel-size">{formatSize(f.size)}</span>
                      <button
                        type="button"
                        className="pf-x"
                        onClick={() => handleUnselect(i)}
                        aria-label={`Убрать ${f.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                  <li className="pf-sel-total">
                    Итого: {formatSize(selectedTotal)}
                    {totalBytes + selectedTotal > MAX_BYTES && (
                      <span className="pf-sel-over"> — превышение лимита</span>
                    )}
                  </li>
                </ul>
              )}

              {uploading && (
                <div className="pf-progress">
                  <span>
                    {uploading.count > 1
                      ? `Файл ${uploading.index} из ${uploading.count}: `
                      : ''}
                    {uploading.name}
                  </span>
                  <div className="pf-bar">
                    <div className="pf-fill" style={{ width: `${uploading.percent}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="settings-card">
              <h3>Мои документы</h3>
              {loading && <p className="muted">Загрузка…</p>}

              {!loading && docs.length === 0 && (
                <p className="muted">
                  Документов пока нет. Нажмите «Выбрать файлы» — загруженные документы
                  появятся в этом списке.
                </p>
              )}

              {docs.length > 0 && (
                <ul className="pf-list">
                  {docs.map((d) => (
                    <li className="pf-file" key={d.id}>
                      <span className="pf-file-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </span>
                      <div className="pf-file-info">
                        <span className="pf-file-name" title={d.filename}>
                          {d.filename}
                        </span>
                        <span className="pf-file-meta">
                          {formatSize(d.size_bytes)} · {formatDate(d.uploaded_at)}
                        </span>
                      </div>
                      <div className="pf-file-actions">
                        <button type="button" className="pf-action" onClick={() => handleDownload(d)}>
                          Скачать
                        </button>
                        <button
                          type="button"
                          className="pf-action pf-action-danger"
                          onClick={() => handleDelete(d)}
                        >
                          Удалить
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
