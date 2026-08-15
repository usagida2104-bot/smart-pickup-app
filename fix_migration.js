const fs = require('fs');

let content = fs.readFileSync('app/board/page.tsx', 'utf8');

// Replace the start of the map function inside syncBoard
const badPattern = `        .map((col: any) => {
          const driver = dailyStaff.find(ds => ds.staff_id === col.driverId);
          return {
            ...col,
            driverStatus: driver?.status,
            driverStatusTime: driver?.status_time,
            driverRole: driver?.role || driver?.staff?.role,
            trips: (col.trips || []).map((trip: any) => ({`;

const goodPattern = `        .map((col: any) => {
          const driver = dailyStaff.find(ds => ds.staff_id === col.driverId);
          // Migrate old data on-the-fly if trips is missing
          const tripsToUse = (col.trips && col.trips.length > 0) ? col.trips : [
            {
              id: \`\${col.shiftId || col.id}-trip-1\`,
              tripIndex: 1,
              children: col.children || []
            }
          ];
          return {
            ...col,
            driverStatus: driver?.status,
            driverStatusTime: driver?.status_time,
            driverRole: driver?.role || driver?.staff?.role,
            trips: tripsToUse.map((trip: any) => ({`;

if (content.includes(badPattern)) {
    content = content.replace(badPattern, goodPattern);
    fs.writeFileSync('app/board/page.tsx', content);
    console.log("Migration logic added to page.tsx");
} else {
    // If we missed something, let's try a simpler regex
    const simpleBad = `        .map((col: any) => {
          const driver = dailyStaff.find(ds => ds.staff_id === col.driverId);
          return {
            ...col,
            driverStatus: driver?.status,
            driverStatusTime: driver?.status_time,
            driverRole: driver?.role || driver?.staff?.role,
            trips: `;
            
    if (content.includes(simpleBad)) {
        console.log("Found simpler pattern, but it wasn't replaced yet");
    } else {
        console.log("Could not find pattern in page.tsx");
    }
}
