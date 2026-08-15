const fs = require('fs');
let code = fs.readFileSync('app/board/page.tsx', 'utf8');

code = code.replace(/\.filter\(col => \{/g, '.filter((col: any) => {');
code = code.replace(/\.map\(col => \{/g, '.map((col: any) => {');
code = code.replace(/\.map\(trip => \(\{/g, '.map((trip: any) => ({');
code = code.replace(/\.filter\(m => \{/g, '.filter((m: any) => {');
code = code.replace(/\.map\(m => \{/g, '.map((m: any) => {');
code = code.replace(/\(col => col\.trips/g, '((col: any) => col.trips');
code = code.replace(/\(t => t\.children/g, '((t: any) => t.children');
code = code.replace(/\(c => c\.id/g, '((c: any) => c.id');

fs.writeFileSync('app/board/page.tsx', code);
console.log("Types added");
