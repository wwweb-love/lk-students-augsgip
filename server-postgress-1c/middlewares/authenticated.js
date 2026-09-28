const { verify } = require("../helpers/token")
const pool = require("../db") // ваш модуль подключения к PostgreSQL

module.exports = async function(req, res, next) {
    if (!req.cookies.token) {
        res.send({error: "Пользователь не авторизован. Авторизуйтесь!"})
        return
    }

    const tokenData = verify(req.cookies.token)
    
    // SQL запрос для поиска пользователя по id
    const query = 'SELECT * FROM users WHERE id = $1'
    const result = await pool.query(query, [tokenData.id])
    
    const user = result.rows[0]
    
    if (!user) {
        res.send({error: "Authenticated user not found"})
        return
    }

    req.user = user

    next()
}