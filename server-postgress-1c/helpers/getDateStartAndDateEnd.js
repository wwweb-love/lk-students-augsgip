const getDateStartAndDateEnd = (dateNow) => {

    if ((Number(dateNow) > Number(`${dateNow.slice(0, 4)}0101`)) && (Number(dateNow) < Number(`${dateNow.slice(0, 4)}0831`))) {

        return {
            dateStart: `${dateNow.slice(0, 4)}0101`,
            dateEnd: `${dateNow.slice(0, 4)}0831`
        }
    } else if ((Number(dateNow) > Number(`${dateNow.slice(0, 4)}0901`)) && (Number(dateNow) < Number(`${dateNow.slice(0, 4)}1230`))) {

        return {
            dateStart: `${dateNow.slice(0, 4)}0901`,
            dateEnd: `${dateNow.slice(0, 4)}1230`
        }
    }
} 

module.exports = {
    getDateStartAndDateEnd
}