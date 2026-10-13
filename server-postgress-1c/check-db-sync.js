// Проверка последней синхронизации в базе данных
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:Hjvfytyrj21!@localhost:5432/test_db'
});

async function checkLastSync() {
    console.log('Проверяем последнюю синхронизацию учебных планов в PostgreSQL...');
    console.log('='.repeat(80));
    
    try {
        // Проверяем таблицу curriculum_1c
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_rows,
                MAX(synced_at) as last_sync,
                MIN(synced_at) as first_sync
            FROM curriculum_1c
        `);
        
        const row = result.rows[0];
        console.log(`Всего записей в curriculum_1c: ${row.total_rows}`);
        console.log(`Первая синхронизация: ${row.first_sync}`);
        console.log(`Последняя синхронизация: ${row.last_sync}`);
        
        if (row.last_sync) {
            const lastSync = new Date(row.last_sync);
            const now = new Date();
            const diffMs = now - lastSync;
            const diffHours = diffMs / (1000 * 60 * 60);
            
            console.log(`\nВремя с последней синхронизации: ${diffHours.toFixed(2)} часов`);
            
            if (diffHours <= 1.5) {
                console.log('✓ Синхронизация работает (была менее 1.5 часов назад)');
            } else if (diffHours <= 25) {
                console.log('⚠ Синхронизация была более 1.5 часов назад, но в пределах суток');
            } else {
                console.log('✗ Синхронизация НЕ работает (была более 25 часов назад)');
            }
        } else {
            console.log('✗ Нет данных о синхронизации');
        }
        
        // Показываем примеры данных
        const sample = await pool.query(`
            SELECT group_name, course, synced_at 
            FROM curriculum_1c 
            ORDER BY synced_at DESC 
            LIMIT 5
        `);
        
        if (sample.rows.length > 0) {
            console.log(`\nПоследние 5 записей:`);
            sample.rows.forEach((r, i) => {
                console.log(`  ${i+1}. ${r.group_name} (курс ${r.course}) - ${r.synced_at.toISOString()}`);
            });
        }
        
    } catch (e) {
        console.error(`Ошибка при проверке базы данных: ${e.message}`);
    } finally {
        await pool.end();
    }
}

checkLastSync();
