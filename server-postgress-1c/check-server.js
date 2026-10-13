// Проверка запущен ли сервер синхронизации
const http = require('http');

const checkServer = (port) => {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: '/api/curriculum/sync',
            method: 'GET',
            timeout: 5000
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({ port, status: res.statusCode, data });
            });
        });
        
        req.on('error', (e) => {
            resolve({ port, error: e.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({ port, error: 'timeout' });
        });
        
        req.end();
    });
};

const ports = [3000, 3001, 8080, 8000, 5000];

console.log('Проверяем запущен ли сервер синхронизации...');
console.log('='.repeat(80));

Promise.all(ports.map(checkServer)).then(results => {
    let found = false;
    for (const r of results) {
        if (r.status) {
            console.log(`✓ Сервер найден на порту ${r.port}, статус: ${r.status}`);
            try {
                const parsed = JSON.parse(r.data);
                console.log(`  Ответ:`, JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log(`  Ответ:`, r.data.substring(0, 200));
            }
            found = true;
        } else {
            console.log(`✗ Порт ${r.port}: ${r.error || 'нет ответа'}`);
        }
    }
    
    if (!found) {
        console.log('\n⚠ Сервер НЕ запущен ни на одном из проверенных портов');
    }
});
