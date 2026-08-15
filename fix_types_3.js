const fs = require('fs');
let code = fs.readFileSync('app/board/page.tsx', 'utf8');

code = code.replace(/\.map\(\(trip, tripIdx\) =>/g, '.map((trip: any, tripIdx: any) =>');
code = code.replace(/\.map\(\(trip\) =>/g, '.map((trip: any) =>');

fs.writeFileSync('app/board/page.tsx', code);
console.log("Fixed more types");
