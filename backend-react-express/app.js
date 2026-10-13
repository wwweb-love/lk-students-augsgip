const express = require('express')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const helmet = require('helmet')

const config = require('./config')
const routes = require('./routes')
const { notFound, errorHandler } = require('./middlewares/error')

const app = express()

app.disable('x-powered-by') // не раскрываем версию Express
// доверяем ровно одному прокси-хопу (Vite dev server): берём последний
// X-Forwarded-For (реальный IP клиента от Vite) для rate-limit,
// подделанные клиентом записи в начале заголовка игнорируются
app.set('trust proxy', 1)
app.use(helmet()) // заголовки безопасности: CSP, X-Frame-Options, X-Content-Type-Options, HSTS…
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Тестовый эндпоинт
app.get('/', (req, res) => {
  res.send('Сервер работает!')
})

app.use('/api', routes)
app.use('/api', notFound)
app.use(errorHandler)

module.exports = app
