const fs = require('fs');
const path = require('path');
const root = path.join(process.env.TEMP, 'opencode', '1cconf');
const rolesDir = path.join(root, 'Roles');
const wanted = ['StudyPlan', 'StudentsGetAll', 'EmployeesGetAll', 'Schedule'];
const found = {};
for (const d of fs.readdirSync(rolesDir)) {
    const p = path.join(rolesDir, d, 'Ext', 'Rights.xml');
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    for (const w of wanted) {
        if (t.includes(w)) {
            found[w] = found[w] || [];
            found[w].push(d);
        }
    }
}
for (const w of wanted) {
    console.log(`\n=== ${w}: ${(found[w] || []).length} ролей`);
    (found[w] || []).forEach(r => console.log('   ', r));
}
