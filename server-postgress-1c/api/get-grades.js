// Запрос журнала оценок из 1С (HTTP-сервис student_lk).
// GET /hs/student_lk/grades — все студенты всех групп с журналом оценок.
// Возвращает Promise<Response>; caller проверяет res.ok сам.
const getGrades1C = (authString) => (
    fetch('http://sql1c-02/college_copy_gun/hs/student_lk/grades', {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        }
    })
)

module.exports = getGrades1C
