const fs = require('fs');
const path = require('path');

const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const out = [];
const push = (...a) => out.push(a.join(' '));

function findFile(sub) {
    const p = path.join(root, sub);
    return fs.existsSync(p) ? p : null;
}
function read(p) { return p ? fs.readFileSync(p, 'utf8') : ''; }

// 1. Структура HTTP-сервиса
push('==================== HTTPServices\\StudentLK_API.xml');
push(read(findFile(path.join('HTTPServices', 'StudentLK_API.xml'))));

// 2. Модуль обработчиков
push('\n==================== HTTPServices\\StudentLK_API\\Ext\\Module.bsl (первые 400 строк)');
push(read(findFile(path.join('HTTPServices', 'StudentLK_API', 'Ext', 'Module.bsl'))).split('\n').slice(0, 400).join('\n'));

fs.writeFileSync(path.join(process.cwd(), '1c-part1.txt'), out.join('\n'), 'utf8');
console.log('written 1c-part1.txt, chars:', out.join('\n').length);
