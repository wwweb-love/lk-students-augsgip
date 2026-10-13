const fs = require('fs');
const path = require('path');
const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const p = path.join(root, 'Roles', 'ПросмотрРасписания', 'Ext', 'Rights.xml');
const t = fs.readFileSync(p, 'utf8');
const lines = t.split('\n');
const out = [];
lines.forEach((l, i) => {
    if (/StudentLK_API/.test(l)) {
        out.push('--- context around line ' + (i + 1));
        for (let k = Math.max(0, i - 3); k <= Math.min(lines.length - 1, i + 4); k++) {
            out.push(String(k + 1).padStart(4) + ': ' + lines[k]);
        }
    }
});
fs.writeFileSync(path.join(process.cwd(), '1c-rights.txt'), out.join('\n'), 'utf8');
console.log('fragments:', out.filter(l => l.startsWith('---')).length, '-> written 1c-rights.txt');
