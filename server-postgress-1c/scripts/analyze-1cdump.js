// Ищем в выгрузке конфигурации 1С (XML + .bsl):
//  1) объекты метаданных, связанные с учебным планом;
//  2) HTTP-сервис student_lk и его модули.
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || path.join(process.env.TEMP, 'opencode', '1cconf');

if (!fs.existsSync(root)) {
    console.error('Нет каталога выгрузки:', root);
    process.exit(1);
}

const files = [];
const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else files.push(p);
    }
};
walk(root);
console.log('Всего файлов выгрузки:', files.length);

const rel = (p) => path.relative(root, p);

// --- 1. структура каталогов верхнего уровня
const tops = [...new Set(files.map(f => rel(f).split(path.sep)[0]))];
console.log('Каталоги:', tops.join(', '));

// --- 2. HTTP-сервис student_lk
console.log('\n=== Файлы HTTPServices:');
files.filter(f => /HTTPServices/i.test(rel(f))).slice(0, 40).forEach(f => console.log('  ', rel(f)));

const slk = files.filter(f => {
    if (!/HTTPServices/i.test(rel(f))) return false;
    try { return fs.readFileSync(f, 'utf8').includes('student_lk'); } catch { return false; }
});
console.log('\n=== Файлы со student_lk:');
slk.forEach(f => console.log('  ', rel(f)));

// --- 3. объекты с «учебн» + «план» в имени/синониме
console.log('\n=== Кандидаты «учебный план»:');
const rx = /<Name>([^<]*)<\/Name>|<Synonym>([^<]*)<\/Synonym>/gi;
const candidates = [];
for (const f of files) {
    if (!/\.xml$/i.test(f)) continue;
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!/учебн/i.test(text)) continue;
    let m; const names = [];
    while ((m = rx.exec(text))) {
        const v = (m[1] || m[2] || '').trim();
        if (v) names.push(v);
    }
    const hasPlan = names.some(n => /план/i.test(n)) || /<Name>[^<]*план/i.test(text);
    if (hasPlan) candidates.push({ file: rel(f), names: [...new Set(names)].slice(0, 6) });
}
candidates.forEach(c => console.log('  ', c.file, '::', c.names.join(' | ')));

// --- 4. модули кандидатов (для понимания структуры полей)
console.log('\n=== XML-файлы кандидатов (первые 2000 символов каждого):');
candidates.slice(0, 6).forEach(c => {
    const p = path.join(root, c.file);
    const t = fs.readFileSync(p, 'utf8');
    console.log('\n--- ' + c.file);
    console.log(t.slice(0, 2000));
});
