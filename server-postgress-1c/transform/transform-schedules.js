const transformSchedules = (schedules) => {
    const transformedData = [];
    
    // Безопасная обрезка строк
    const safeString = (str, maxLength) => {
        if (!str) return null;
        const clean = String(str).trim();
        return clean.length > maxLength ? clean.substring(0, maxLength) : clean;
    };
    
    schedules.forEach(schedule => {
        const { group, date, pairs } = schedule;
        
        // Обрезаем группу до 200 символов
        const cleanGroup = safeString(group, 200) || 'Не указано';
        const cleanDate = date ? String(date).substring(0, 8) : '';
        
        if (!pairs || !Array.isArray(pairs)) {
            return;
        }
        
        pairs.forEach(pair => {
            const { time_start, time_end, subject, teacher, room, type } = pair;
            
            // Формируем время
            const timeStr = `${time_start || ''} - ${time_end || ''}`.trim();
            
            transformedData.push({
                date: cleanDate,
                group: cleanGroup,
                time: timeStr || 'Не указано',
                // Обрезаем длинные строки
                subject: safeString(subject, 500) || 'Не указано',
                teacher: safeString(teacher, 500) || 'Не указано',
                room: safeString(room, 200) || null,
                type: safeString(type, 200) || 'Не указано'
            });
        });
    });
    
    return transformedData;
};

module.exports = {
    transformSchedules
};