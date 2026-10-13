const fs = require('fs');
const path = require('path');
const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const p = path.join(root, 'HTTPServices', 'StudentLK_API', 'Ext', 'Module.bsl');
const lines = fs.readFileSync(p, 'utf8').split('\n');
fs.writeFileSync(path.join(process.cwd(), '1c-module-rest.txt'), lines.slice(400).join('\n'), 'utf8');
console.log('total lines:', lines.length, '-> written rest:', lines.length - 400);
