const getStudents1C = (authString) => (
    fetch('http://sql1c-02/college_copy_gun/hs/student_lk/students', {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
        }
    })
)

module.exports = getStudents1C
