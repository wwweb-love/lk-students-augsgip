const getDateStartAndDateEndYear = (year, month, day) => {

    if (Number(month) > 8) {
        return {
            dateStart: `${year}0901`,
            dateEnd: `${Number(year) + 1}0730`
        }
    } else {
        return {
            dateStart: `${Number(year) - 1}0901`,
            dateEnd: `${year}0730`
        }
    }
} 

module.exports = {
    getDateStartAndDateEndYear
}