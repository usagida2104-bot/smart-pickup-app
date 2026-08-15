const fs = require('fs');
let content = fs.readFileSync('app/board/page.tsx', 'utf8');

const startIndex = content.indexOf('const handleReset = (overrideAtts?: DailyAttendance[]) => {');
const endIndex = content.indexOf('const initialColumns = dynamicShifts.map');

if (startIndex !== -1 && endIndex !== -1) {
  const newBlock = `const handleReset = (overrideAtts?: DailyAttendance[]) => {
    const state = useBoardStore.getState();
    const attsToUse = overrideAtts || attendances;
    
    const inboundChildren = attsToUse
      .filter(a => {
        const status = a.status || "both";
        return ["both", "pickup_only"].includes(status);
      })
      .filter(a => {
        const child = children.find((c: any) => c.id === a.child_id);
        const isAbsent = (a.attendance_status || child?.status) === "absent" || a.status === "absent";
        return child && !isAbsent;
      })
      .map(a => toMagnet(a.child_id, children, attsToUse));
      
    const outboundChildren = attsToUse
      .filter(a => {
        const status = a.status || "both";
        return ["both", "dropoff_only"].includes(status);
      })
      .filter(a => {
        const child = children.find((c: any) => c.id === a.child_id);
        const isAbsent = (a.attendance_status || child?.status) === "absent" || a.status === "absent";
        return child && !isAbsent;
      })
      .map(a => toMagnet(a.child_id, children, attsToUse));

    if (activeTab === "inbound") {
      setBoard("inbound", {
        columns: state.inboundBoard.columns.map((col: any) => ({
          ...col,
          trips: (col.trips || []).map((trip: any) => ({
            ...trip,
            children: [],
          })),
        })),
        unassigned: { id: "unassigned", children: inboundChildren },
      });
    } else {
      setBoard("outbound", {
        columns: state.outboundBoard.columns.map((col: any) => ({
          ...col,
          trips: (col.trips || []).map((trip: any) => ({
            ...trip,
            children: [],
          })),
        })),
        unassigned: { id: "unassigned", children: outboundChildren },
      });
    }

    // リセット後、最新状態をSupabaseに上書き保存
    setTimeout(async () => {
      await performAutoSave();
    }, 0);
  };

  // 車両カラムの初期値: `;

  content = content.substring(0, startIndex) + newBlock + content.substring(endIndex + 'const initialColumns = '.length);
  fs.writeFileSync('app/board/page.tsx', content);
  console.log("Replaced handleReset");
} else {
  console.log("Could not find blocks");
}
