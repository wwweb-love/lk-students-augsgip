// Сравнение disciplines и raw в таблице curriculum_1c
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:Hjvfytyrj21!@localhost:5432/test_db'
});

async function compareDisciplinesAndRaw() {
    console.log('Сравниваем disciplines и raw в таблице curriculum_1c...');
    console.log('='.repeat(80));
    
    try {
        // Берём одну запись для примера
        const result = await pool.query(`
            SELECT 
                group_name,
                disciplines,
                raw
            FROM curriculum_1c 
            WHERE group_name = '11А-201'
            LIMIT 1
        `);
        
        if (result.rows.length === 0) {
            console.log('Запись не найдена');
            return;
        }
        
        const row = result.rows[0];
        
        console.log(`Группа: ${row.group_name}`);
        console.log('='.repeat(80));
        
        // Показываем disciplines
        console.log('\n📋 disciplines (JSONB):');
        console.log('-'.repeat(80));
        console.log(`Тип: ${typeof row.disciplines}`);
        console.log(`Это массив: ${Array.isArray(row.disciplines)}`);
        console.log(`Количество дисциплин: ${row.disciplines.length}`);
        console.log(`Первая дисциплина:`, JSON.stringify(row.disciplines[0], null, 2));
        console.log(`Последняя дисциплина:`, JSON.stringify(row.disciplines[row.disciplines.length - 1], null, 2));
        
        // Показываем raw
        console.log('\n📦 raw (JSONB):');
        console.log('-'.repeat(80));
        console.log(`Тип: ${typeof row.raw}`);
        console.log(`Ключи объекта: ${Object.keys(row.raw).join(', ')}`);
        console.log(`Содержит group_name: ${row.raw.group_name}`);
        console.log(`Содержит course: ${row.raw.course}`);
        console.log(`Содержит admission_year: ${row.raw.admission_year}`);
        console.log(`Содержит plan: ${JSON.stringify(row.raw.plan, null, 2)}`);
        console.log(`Содержит disciplines: ${Array.isArray(row.raw.disciplines)} (количество: ${row.raw.disciplines ? row.raw.disciplines.length : 0})`);
        
        // Сравниваем
        console.log('\n🔍 Сравнение:');
        console.log('-'.repeat(80));
        
        const disciplinesFromRaw = row.raw.disciplines || [];
        const disciplinesDirect = row.disciplines || [];
        
        console.log(`disciplines (напрямую): ${disciplinesDirect.length} дисциплин`);
        console.log(`raw.disciplines (внутри raw): ${disciplinesFromRaw.length} дисциплин`);
        
        // Проверяем идентичность
        const areEqual = JSON.stringify(disciplinesDirect) === JSON.stringify(disciplinesFromRaw);
        console.log(`\nИдентичны ли данные: ${areEqual ? '✅ ДА' : '❌ НЕТ'}`);
        
        if (!areEqual) {
            console.log('\nРазличия:');
            // Находим различия
            const maxLen = Math.max(disciplinesDirect.length, disciplinesFromRaw.length);
            for (let i = 0; i < maxLen; i++) {
                const d1 = disciplinesDirect[i];
                const d2 = disciplinesFromRaw[i];
                if (JSON.stringify(d1) !== JSON.stringify(d2)) {
                    console.log(`  Дисциплина ${i}:`);
                    console.log(`    disciplines[${i}]: ${JSON.stringify(d1)}`);
                    console.log(`    raw.disciplines[${i}]: ${JSON.stringify(d2)}`);
                }
            }
        }
        
        // Показываем что есть в raw, но нет в disciplines
        console.log('\n📊 Что есть в raw, но НЕ в disciplines:');
        console.log('-'.repeat(80));
        console.log(`- group_name: "${row.raw.group_name}"`);
        console.log(`- course: ${row.raw.course}`);
        console.log(`- admission_year: ${row.raw.admission_year}`);
        console.log(`- plan: объект с полями ${Object.keys(row.raw.plan || {}).join(', ')}`);
        
        // Показываем размеры
        console.log('\n📏 Размеры данных:');
        console.log('-'.repeat(80));
        const disciplinesSize = JSON.stringify(row.disciplines).length;
        const rawSize = JSON.stringify(row.raw).length;
        console.log(`disciplines: ${disciplinesSize} байт`);
        console.log(`raw: ${rawSize} байт`);
        console.log(`raw больше чем disciplines в ${(rawSize / disciplinesSize).toFixed(2)} раз`);
        
    } catch (e) {
        console.error(`Ошибка: ${e.message}`);
    } finally {
        await pool.end();
    }
}

compareDisciplinesAndRaw();
