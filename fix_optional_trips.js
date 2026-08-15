const fs = require('fs');

function processFile(path) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    
    // Safety wrap for col.trips
    content = content.replace(/col\.trips\.map/g, '(col.trips || []).map');
    content = content.replace(/col\.trips\.flatMap/g, '(col.trips || []).flatMap');
    content = content.replace(/col\.trips\.filter/g, '(col.trips || []).filter');
    content = content.replace(/col\.trips\.some/g, '(col.trips || []).some');
    content = content.replace(/col\.trips\.find/g, '(col.trips || []).find');
    content = content.replace(/col\.trips\.reduce/g, '(col.trips || []).reduce');
    content = content.replace(/col\.trips\.length/g, '(col.trips || []).length');

    // Safety wrap for column.trips
    content = content.replace(/column\.trips\.map/g, '(column.trips || []).map');
    content = content.replace(/column\.trips\.flatMap/g, '(column.trips || []).flatMap');
    content = content.replace(/column\.trips\.filter/g, '(column.trips || []).filter');
    content = content.replace(/column\.trips\.some/g, '(column.trips || []).some');
    content = content.replace(/column\.trips\.find/g, '(column.trips || []).find');
    content = content.replace(/column\.trips\.reduce/g, '(column.trips || []).reduce');
    content = content.replace(/column\.trips\.length/g, '(column.trips || []).length');
    
    // Safety wrap for trip.children and t.children
    content = content.replace(/trip\.children\.map/g, '(trip.children || []).map');
    content = content.replace(/trip\.children\.flatMap/g, '(trip.children || []).flatMap');
    content = content.replace(/trip\.children\.filter/g, '(trip.children || []).filter');
    content = content.replace(/trip\.children\.some/g, '(trip.children || []).some');
    content = content.replace(/trip\.children\.length/g, '(trip.children || []).length');
    content = content.replace(/\.\.\.trip\.children/g, '...(trip.children || [])');

    content = content.replace(/t\.children\.map/g, '(t.children || []).map');
    content = content.replace(/t\.children\.length/g, '(t.children || []).length');

    // unassigned children
    content = content.replace(/boardState\.unassigned\.children/g, '(boardState.unassigned?.children || [])');
    content = content.replace(/board\.unassigned\.children/g, '(board.unassigned?.children || [])');
    content = content.replace(/unassigned\.children/g, '(unassigned?.children || [])');

    // board columns
    content = content.replace(/board\.columns\.length/g, '(board?.columns || []).length');
    content = content.replace(/board\.columns\.flatMap/g, '(board?.columns || []).flatMap');
    content = content.replace(/boardState\.columns\s*\n\s*\.filter/g, '(boardState.columns || [])\n        .filter');
    content = content.replace(/boardState\.columns\.filter/g, '(boardState.columns || []).filter');

    // assignment trips
    content = content.replace(/assignment\?\.trips\?\.map/g, '(assignment?.trips || []).map');

    // For assignments inside boardStore where it modifies trips
    content = content.replace(/\.\.\.col\.trips/g, '...(col.trips || [])');

    fs.writeFileSync(path, content);
}

processFile('app/board/page.tsx');
processFile('lib/store/boardStore.ts');
processFile('components/board/VehicleColumn.tsx');
processFile('app/api/auto-assign/route.ts');
console.log("Replaced safely");
