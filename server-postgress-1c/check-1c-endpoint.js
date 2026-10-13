// Проверка доступности 1С endpoint'а для учебных планов
const http = require('http');

const ONEC_USER = 'РоманенкоРВ';
const ONEC_PASSWORD = 'Hjvfytyrj21!';
const auth = Buffer.from(`${ONEC_USER}:${ONEC_PASSWORD}`).toString('base64');

const options = {
    hostname: 'sql1c-02',
    port: 80,
    path: '/college_copy_gun/hs/student_lk/study_plan',
    method: 'GET',
    headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
    },
    timeout: 10000
};

console.log('Проверяем доступность 1С endpoint: http://sql1c-02/college_copy_gun/hs/student_lk/study_plan');
console.log('='.repeat(80));

const req = http.request(options, (res) => {
    let data = '';
    
    console.log(`Статус ответа: ${res.statusCode} ${res.statusMessage}`);
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        console.log(`Размер ответа: ${data.length} байт`);
        
        if (data.length > 0) {
            try {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    console.log(`Ответ содержит массив из ${parsed.length} элементов`);
                    if (parsed.length > 0) {
                        console.log(`Первый элемент:`, JSON.stringify(parsed[0], null, 2));
                    }
                } else {
                    console.log(`Ответ:`, JSON.stringify(parsed, null, 2).substring(0, 500));
                }
            } catch (e) {
                console.log(`Ответ (текст, первые 500 символов):`, data.substring(0, 500));
            }
        }
        
        console.log('\n' + '='.repeat(80));
        if (res.statusCode === 200 && data.length > 0) {
            console.log('ИТОГ: 1С endpoint ДОСТУПЕН и возвращает данные');
        } else {
            console.log('ИТОГ: 1С endpoint НЕ РАБОТАЕТ или не возвращает данные');
        }
    });
});

req.on('error', (e) => {
    console.error(`ОШИБКА подключения к 1С: ${e.message}`);
    console.log('='.repeat(80));
    console.log('ИТОГ: 1С endpoint НЕДОСТУПЕН');
});

req.on('timeout', () => {
    console.error('Таймаут подключения к 1С (10 сек)');
    req.destroy();
});

req.end();
