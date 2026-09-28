require('dotenv').config();

const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require('cors')


const server = express()

server.use(cors({
    origin: 'http://localhost:5174',
    credentials: true
}));

server.use(express.json())
server.use(cookieParser())
server.use(express.urlencoded({ extended: true }));


const schedulesRouter = require('./routes/schedules.js');
server.use('/api/schedules', schedulesRouter);

const studentsRouter = require('./routes/students.js');
server.use('/api/students', studentsRouter);

// Тестовый эндпоинт
server.get('/', (req, res) => {
  res.send('Сервер работает!');
});

server.listen(5000, () => console.log("Server started..."))