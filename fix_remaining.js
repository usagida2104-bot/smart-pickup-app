const fs = require('fs');
let code = fs.readFileSync('__tests__/autoAssignVehicles.test.ts', 'utf8');

code = code.replace(/columns\[0\]\.children/g, 'columns[0].trips[0].children');
code = code.replace(/columns\[1\]\.children/g, 'columns[1].trips[0].children');
code = code.replace(/v1\?\.children/g, 'v1?.trips[0].children');
code = code.replace(/v2\?\.children/g, 'v2?.trips[0].children');
code = code.replace(/col\.children/g, 'col.trips[0].children');

code = code.replace(
`    expect(result.columns[0].trips[0].children.length).toBe(2);
    expect(result.unassigned.length).toBe(1);
    expect(result.unassigned[0].id).toBe("3"); // Last one due to pickup_time sorting`,
`    expect(result.columns[0].trips[0].children.length).toBe(2);
    expect(result.columns[0].trips.length).toBe(2);
    expect(result.columns[0].trips[1].children[0].id).toBe("3");
    expect(result.unassigned.length).toBe(0);`
);

fs.writeFileSync('__tests__/autoAssignVehicles.test.ts', code);
console.log("Tests fixed");

let routeCode = fs.readFileSync('app/api/auto-assign/route.ts', 'utf8');
routeCode = routeCode.replace(/col\.children\.map/g, 'col.trips.flatMap((t: any) => t.children).map');
fs.writeFileSync('app/api/auto-assign/route.ts', routeCode);
console.log("Route fixed");
