const fs = require('fs');
let lines = fs.readFileSync('app/board/page.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex(line => line.includes('driverRole: driver?.role || driver?.staff?.role'));

if (startIndex !== -1) {
  const replacement = `  // 同期用useEffect (児童およびスタッフ情報が更新されたらボード上の情報を最新化)
  useEffect(() => {
    if (children.length === 0 || attendances.length === 0) return;

    const syncBoard = (boardState: BoardState, mode: "inbound" | "outbound") => {
      const newCols = boardState.columns
        .filter(col => {
          // シフトが存在しなくなったら除外（dynamicShiftsにあるか）
          return dynamicShifts.some(shift => shift.id === col.shiftId || (shift.vehicle_id === col.vehicleId && !shift.id));
        })
        .map(col => {
          const driver = dailyStaff.find(ds => ds.staff_id === col.driverId);
          return {
            ...col,
            driverStatus: driver?.status,
            driverStatusTime: driver?.status_time,
            driverRole: driver?.role || driver?.staff?.role,`;

  lines[startIndex] = replacement;
  fs.writeFileSync('app/board/page.tsx', lines.join('\n'));
  console.log("Replaced successfully at index " + startIndex);
} else {
  console.log("No match found!");
}
