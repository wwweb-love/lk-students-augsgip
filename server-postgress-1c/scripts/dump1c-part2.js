const fs = require('fs');
const path = require('path');

const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const out = [];
const push = (...a) => out.push(a.join(' '));

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

function summarizeObject(relXml) {
    const p = path.join(root, relXml);
    const t = read(p);
    push('==================== ' + relXml);
    if (!t) { push('  НЕ НАЙДЕН'); return; }
    // имя, синоним
    const name = (t.match(/<Name>([^<]*)<\/Name>/) || [])[1];
    const syn = (t.match(/<Synonym>\s*<v8:item>[\s\S]*?<v8:content[^>]*>([^<]*)</) || [])[1];
    push('  Имя: ' + name + '   Синоним: ' + syn);
    // реквизиты
    const attrs = [...t.matchAll(/<Attribute>([\s\S]*?)<\/Attribute>/g)].map(m => m[1]);
    push('  Реквизитов: ' + attrs.length);
    attrs.forEach(a => {
        const an = (a.match(/<Name>([^<]*)<\/Name>/) || [])[1];
        const asy = (a.match(/<Synonym>\s*<v8:item>[\s\S]*?<v8:content[^>]*>([^<]*)</) || [])[1];
        const ty = (a.match(/<Type>\s*<v8:type>([^<]*)</) || [])[1];
        push('    - ' + an + (asy && asy !== an ? ' (' + asy + ')' : '') + ' : ' + ty);
    });
    // табличные части
    const tss = [...t.matchAll(/<TabularSection>([\s\S]*?)<\/TabularSection>/g)].map(m => m[1]);
    push('  Табличных частей: ' + tss.length);
    tss.forEach(ts => {
        const tn = (ts.match(/<Name>([^<]*)<\/Name>/) || [])[1];
        const tsy = (ts.match(/<Synonym>\s*<v8:item>[\s\S]*?<v8:content[^>]*>([^<]*)</) || [])[1];
        push('    * ' + tn + (tsy && tsy !== tn ? ' (' + tsy + ')' : ''));
        const inner = [...ts.matchAll(/<Attribute>([\s\S]*?)<\/Attribute>/g)].map(m => m[1]);
        inner.forEach(a => {
            const an = (a.match(/<Name>([^<]*)<\/Name>/) || [])[1];
            const asy = (a.match(/<Synonym>\s*<v8:item>[\s\S]*?<v8:content[^>]*>([^<]*)</) || [])[1];
            const ty = (a.match(/<Type>\s*<v8:type>([^<]*)</) || [])[1];
            push('        - ' + an + (asy && asy !== an ? ' (' + asy + ')' : '') + ' : ' + ty);
        });
    });
    push('');
}

summarizeObject(path.join('Catalogs', 'РабочиеУчебныеПланы.xml'));
summarizeObject(path.join('Catalogs', 'УчебныеГруппы.xml'));
summarizeObject(path.join('Catalogs', 'Специальности.xml'));
summarizeObject(path.join('Catalogs', 'Дисциплины.xml'));

fs.writeFileSync(path.join(process.cwd(), '1c-part2.txt'), out.join('\n'), 'utf8');
console.log('written 1c-part2.txt, chars:', out.join('\n').length);
