import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'
import { ThemeToggle } from '../components/ThemeToggle'
import { avatarFor } from '../utils/avatar'
import './SettingsPage.css'
import './MessengerPage.css'

// Инициалы для аватара: первые буквы ФИО
const initials = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w ? w[0].toUpperCase() : ''))
    .join('')

// Время сообщения: «14:25» для сегодняшних, иначе «ДД.ММ ЧЧ:ММ»
function formatTime(stamp) {
  if (!stamp) return ''
  const d = new Date(String(stamp).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const sameDay = d.toDateString() === new Date().toDateString()
  if (sameDay) return `${hh}:${mm}`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${hh}:${mm}`
}

// Иконка письма (конверт) — открывает чат с найденным студентом
function MailIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"></rect>
      <path d="M22 6l-10 7L2 6"></path>
    </svg>
  )
}

// Иконка отправки (самолётик)
function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="12"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  )
}

// Мессенджер: поиск студента по ФИО + диалоги (GET/POST /api/messages)
export function MessengerPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Поиск по ФИО
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Диалоги и открытый чат
  const [threads, setThreads] = useState([])
  const [peer, setPeer] = useState(null)
  const [messages, setMessages] = useState([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [threadError, setThreadError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  // Всплывающие уведомления о новых входящих (показываются 5 с)
  const [toasts, setToasts] = useState([])

  const peerRef = useRef(null)
  const bottomRef = useRef(null)
  // Снимок непрочитанных для детекции новых сообщений: null — ещё не загрузили
  const seenRef = useRef(null)
  const timersRef = useRef(new Map())

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [])

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }, [navigate])

  // Уведомление о новом входящем; максимум 3 одновременно, живёт 5 секунд
  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }])
    const timer = setTimeout(() => {
      timersRef.current.delete(id)
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
    timersRef.current.set(id, timer)
  }, [])

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id)
    if (timer) clearTimeout(timer)
    timersRef.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Чистим таймеры при размонтировании страницы
  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
    },
    []
  )

  // Список диалогов (последнее сообщение + непрочитанные)
  const loadThreads = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch('/api/messages/threads', {
          headers: authHeaders(),
          credentials: 'include',
        })
        if (res.status === 401) return handleUnauthorized()
        const body = await res.json().catch(() => null)
        if (!res.ok || body?.error) {
          if (!silent) setThreadError(body?.error || 'Не удалось загрузить диалоги')
          return
        }
        const list = Array.isArray(body.data?.threads) ? body.data.threads : []
        setThreads(list)

        // Детекция новых входящих: рост числа непрочитанных → уведомление
        const per = {}
        let total = 0
        for (const t of list) {
          const u = Number(t.unread) || 0
          per[t.peer_snils] = u
          total += u
        }
        if (seenRef.current && total > seenRef.current.total) {
          const fresh = list
            .filter((t) => (seenRef.current.per[t.peer_snils] || 0) < (Number(t.unread) || 0))
            .sort((a, b) => new Date(b.last_at) - new Date(a.last_at))
          const t = fresh[0]
          if (t) {
            pushToast({
              snils: t.peer_snils,
              name: t.peer_name || t.peer_snils,
              body: t.last_body || 'Новое сообщение',
            })
          }
        }
        seenRef.current = { total, per }
      } catch {
        if (!silent) setThreadError('Ошибка подключения к серверу')
      }
    },
    [authHeaders, handleUnauthorized, pushToast]
  )

  // Переписка с участником; открытая вкладка помечает входящие прочитанными
  const loadThread = useCallback(
    async (snils, silent = false) => {
      if (!silent) setLoadingThread(true)
      try {
        const res = await fetch(`/api/messages/thread?snils=${encodeURIComponent(snils)}`, {
          headers: authHeaders(),
          credentials: 'include',
        })
        if (res.status === 401) return handleUnauthorized()
        const body = await res.json().catch(() => null)
        if (!res.ok || body?.error) {
          if (!silent) setThreadError(body?.error || 'Не удалось загрузить переписку')
          return
        }
        setMessages(Array.isArray(body.data?.messages) ? body.data.messages : [])
        loadThreads(true)
      } catch {
        if (!silent) setThreadError('Ошибка подключения к серверу')
      } finally {
        if (!silent) setLoadingThread(false)
      }
    },
    [authHeaders, handleUnauthorized, loadThreads]
  )

  // Поиск по ФИО с дебаунсом 300 мс (минимум 2 символа)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearchError('')
      setSearching(false)
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      setSearchError('')
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`, {
          headers: authHeaders(),
          credentials: 'include',
        })
        if (cancelled) return
        if (res.status === 401) return handleUnauthorized()
        const body = await res.json().catch(() => null)
        if (!res.ok || body?.error) setSearchError(body?.error || 'Ошибка поиска')
        else setResults(Array.isArray(body.data?.students) ? body.data.students : [])
      } catch {
        if (!cancelled) setSearchError('Ошибка подключения к серверу')
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, authHeaders, handleUnauthorized])

  // Начальная загрузка
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      navigate('/login')
      return
    }
    setUser(JSON.parse(savedUser))
    loadThreads()
  }, [navigate, loadThreads])

  // Опрос: диалоги и открытый чат каждые 5 секунд
  useEffect(() => {
    const timer = setInterval(() => {
      loadThreads(true)
      if (peerRef.current) loadThread(peerRef.current.snils, true)
    }, 5000)
    return () => clearInterval(timer)
  }, [loadThreads, loadThread])

  // Прокрутка чата вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  // Открыть чат: и из результатов поиска, и из списка диалогов
  const openChat = (person) => {
    peerRef.current = person
    setPeer(person)
    setMessages([])
    setThreadError('')
    loadThread(person.snils)
  }

  // Отправить сообщение
  const send = async (e) => {
    e.preventDefault()
    const bodyText = draft.trim()
    if (!bodyText || !peer || sending) return
    setSending(true)
    setThreadError('')
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipient_snils: peer.snils, body: bodyText }),
      })
      if (res.status === 401) return handleUnauthorized()
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.error) {
        setThreadError(body?.error || 'Не удалось отправить сообщение')
        return
      }
      setDraft('')
      await loadThread(peer.snils)
      loadThreads(true)
    } catch {
      setThreadError('Ошибка подключения к серверу')
    } finally {
      setSending(false)
    }
  }

  if (!user) return null

  const totalUnread = threads.reduce((sum, t) => sum + (Number(t.unread) || 0), 0)
  const showSearch = query.trim().length >= 2

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

        <main className="settings-main messenger-main">
          <div className="settings-content">
            <div className="page-head">
              <div>
                <p className="eyebrow">Личный кабинет</p>
                <h2>Мессенджер</h2>
                <p className="muted">
                  Найдите студента по ФИО и напишите ему — {totalUnread > 0 ? `непрочитанных: ${totalUnread}` : 'диалоги хранятся здесь'}
                </p>
              </div>
            </div>

            <div className="messenger">
              {/* Левая колонка: поиск + диалоги */}
              <aside className="messenger-sidebar">
                <div className="messenger-search">
                  <svg className="messenger-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="search"
                    placeholder="Найти студента по ФИО…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                {showSearch && (
                  <div className="messenger-block">
                    <h4 className="messenger-block-title">Результаты поиска</h4>
                    {searching && <p className="muted messenger-hint">Ищем…</p>}
                    {searchError && <p className="status error">{searchError}</p>}
                    {!searching && !searchError && results.length === 0 && (
                      <p className="muted messenger-hint">Ничего не найдено</p>
                    )}
                    {results.map((s) => (
                      <div className="messenger-row" key={s.snils}>
                        <div className="messenger-row-main">
                          <span className="messenger-avatar">{initials(s.name)}</span>
                          <span className="messenger-row-text">
                            <span className="messenger-row-name">{s.name}</span>
                            <span className="muted messenger-row-sub">{s.group_name || '—'}</span>
                          </span>
                        </div>
                        <button
                          className="messenger-envelope"
                          title="Написать сообщение"
                          onClick={() => openChat({ snils: s.snils, name: s.name, group_name: s.group_name })}
                        >
                          <MailIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="messenger-block">
                  <h4 className="messenger-block-title">
                    Диалоги{totalUnread > 0 && <span className="messenger-unread-chip">{totalUnread}</span>}
                  </h4>
                  {threads.length === 0 && !searchError && (
                    <p className="muted messenger-hint">
                      Диалогов пока нет. Найдите студента по ФИО и нажмите на иконку письма ✉
                    </p>
                  )}
                  {threads.map((t) => (
                    <button
                      key={t.peer_snils}
                      className={`messenger-row messenger-thread${peer?.snils === t.peer_snils ? ' messenger-thread-active' : ''}`}
                      onClick={() => openChat({ snils: t.peer_snils, name: t.peer_name || t.peer_snils })}
                    >
                      <span className="messenger-avatar">{initials(t.peer_name || t.peer_snils)}</span>
                      <span className="messenger-row-text">
                        <span className="messenger-row-name">{t.peer_name || t.peer_snils}</span>
                        <span className="muted messenger-row-sub messenger-preview">{t.last_body || ''}</span>
                      </span>
                      <span className="messenger-row-side">
                        <span className="messenger-row-time">{formatTime(t.last_at)}</span>
                        {Number(t.unread) > 0 && <span className="messenger-unread-chip">{t.unread}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Правая колонка: чат */}
              <section className="messenger-chat">
                {!peer ? (
                  <div className="messenger-placeholder">
                    <MailIcon size={44} />
                    <p>Выберите диалог или найдите студента по ФИО</p>
                    <p className="muted">Чат начинается с первого сообщения</p>
                  </div>
                ) : (
                  <>
                    <header className="messenger-chat-head">
                      <span className="messenger-avatar">{initials(peer.name)}</span>
                      <span className="messenger-row-text">
                        <span className="messenger-row-name">{peer.name}</span>
                        <span className="muted messenger-row-sub">{peer.group_name || '—'}</span>
                      </span>
                    </header>

                    <div className="messenger-messages">
                      {loadingThread && messages.length === 0 && <p className="muted messenger-hint">Загрузка переписки…</p>}
                      {!loadingThread && messages.length === 0 && (
                        <p className="muted messenger-hint messenger-hint-center">
                          Сообщений пока нет — напишите первым
                        </p>
                      )}
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`messenger-msg ${m.direction === 'out' ? 'msg-out' : 'msg-in'}`}
                        >
                          <span className="messenger-msg-body">{m.body}</span>
                          <span className="messenger-msg-meta">
                            {formatTime(m.created_at)}
                            {m.direction === 'out' && <span className="messenger-ticks">{m.read ? ' ✓✓' : ' ✓'}</span>}
                          </span>
                        </div>
                      ))}
                      <div ref={bottomRef} />
                    </div>

                    {threadError && <p className="status error messenger-thread-error">{threadError}</p>}

                    <form className="messenger-compose" onSubmit={send}>
                      <input
                        placeholder="Сообщение…"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={2000}
                        aria-label="Текст сообщения"
                      />
                      <button
                        type="submit"
                        className="btn messenger-send"
                        disabled={sending || !draft.trim()}
                        title="Отправить"
                      >
                        <SendIcon />
                      </button>
                    </form>
                  </>
                )}
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* Уведомления о новых сообщениях: справа сверху, 5 секунд */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="messenger-toast"
            title="Открыть чат"
            onClick={() => {
              dismissToast(t.id)
              openChat({ snils: t.snils, name: t.name })
            }}
          >
            <button
              className="messenger-toast-close"
              title="Скрыть"
              onClick={(e) => {
                e.stopPropagation()
                dismissToast(t.id)
              }}
            >
              ×
            </button>
            <div className="messenger-toast-title">
              <MailIcon size={14} /> {t.name}
            </div>
            <div className="messenger-toast-body">{t.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
