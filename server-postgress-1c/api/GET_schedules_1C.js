const GET_schedules_1C = () => {
    fetch(`http://sql1c-02/college_copy1/hs/student_lk//schedule/2025000657/20260101/20261230`).then(loaded => loaded.json()).then(loaded => console.log(loaded))
}

module.exports = {
    GET_schedules_1C
}