const fs = require('fs');
let content = fs.readFileSync('lib/store/boardStore.ts', 'utf8');

content = content.replace(/children: col\.children \|\| \[\]/g, 'children: (col as any).children || []');

fs.writeFileSync('lib/store/boardStore.ts', content);
console.log("Fixed store TS error");
