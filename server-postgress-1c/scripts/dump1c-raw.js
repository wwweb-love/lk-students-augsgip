const fs = require('fs');
const path = require('path');
const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const out = [];
for (const f of ['СтрокиРУП.xml', 'РабочиеУчебныеПланы.xml']) {
    const p = path.join(root, 'Catalogs', f);
    const t = fs.readFileSync(p, 'utf8');
    out.push('==================== ' + f + ' (всего ' + t.length + ' символов)');
    out.push(t.slice(0, 4000));
}
fs.writeFileSync(path.join(process.cwd(), '1c-raw.txt'), out.join('\n'), 'utf8');
console.log('written 1c-raw.txt');
