const fs = require('fs');
const path = require('path');

const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const out = [];
const push = (...a) => out.push(a.join(' '));
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

const nameOf = (block) => (block.match(/<Name>([^<]*)<\/Name>/) || [])[1] || '';
const synOf = (block) => (block.match(/<Synonym>[\s\S]*?<v8:content>([^<]*)<\/v8:content>/) || [])[1] || '';
const typeOf = (block) => {
    const b = block.match(/<Type>([\s\S]*?)<\/Type>/);
    if (!b) return '';
    const inner = b[1].match(/>\s*([^<>]*\S)\s*</);
    return inner ? inner[1].replace(/^cfg:/, '') : '';
};
const all = (text, tag) => [...text.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g'))];

function describe(folder, objFile) {
    const xml = read(path.join(root, folder, objFile));
    if (!xml) { push('НЕТ: ' + folder + '/' + objFile); return; }
    push('==================== ' + folder + '/' + objFile);
    push('  Имя: ' + nameOf(xml) + '   Синоним: ' + synOf(xml));

    const tsBlocks = all(xml, 'TabularSection');
    const tsRanges = tsBlocks.map(m => ({ start: m.index, end: m.index + m[0].length, name: nameOf(m[1]), syn: synOf(m[1]), block: m[1] }));

    const attrs = all(xml, 'Attribute').filter(m => !tsRanges.some(r => m.index > r.start && m.index < r.end));
    push('  Реквизитов: ' + attrs.length);
    attrs.forEach(m => push('    - ' + nameOf(m[1]) + (synOf(m[1]) && synOf(m[1]) !== nameOf(m[1]) ? ' (' + synOf(m[1]) + ')' : '') + (typeOf(m[1]) ? ' : ' + typeOf(m[1]) : '')));

    push('  Табличных частей: ' + tsRanges.length);
    tsRanges.forEach(r => {
        push('    * ' + r.name + (r.syn && r.syn !== r.name ? ' (' + r.syn + ')' : ''));
        all(r.block, 'Attribute').forEach(m => push('        - ' + nameOf(m[1]) + (synOf(m[1]) && synOf(m[1]) !== nameOf(m[1]) ? ' (' + synOf(m[1]) + ')' : '') + (typeOf(m[1]) ? ' : ' + typeOf(m[1]) : '')));
    });
    push('');
}

describe('Catalogs', 'РабочиеУчебныеПланы.xml');
describe('Catalogs', 'СтрокиРУП.xml');
describe('Catalogs', 'Специальности.xml');
describe('Catalogs', 'УчебныеГруппы.xml');

fs.writeFileSync(path.join(process.cwd(), '1c-objects.txt'), out.join('\n'), 'utf8');
console.log('written 1c-objects.txt');
