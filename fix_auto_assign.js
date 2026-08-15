const fs = require('fs');
let content = fs.readFileSync('app/board/page.tsx', 'utf8');

// I'll use a regex or string index to find handleAutoAssign and replace the block
const startText = '        const res = await fetch("/api/auto-assign"';
const endText = 'setTimeout(async () => {\n          await performAutoSave();\n        }, 0);';

if (content.includes(startText) && content.includes(endText)) {
  const startIndex = content.indexOf(startText);
  const endIndex = content.indexOf(endText) + endText.length;
  
  const newBlock = `
        const inputShifts = shiftsWithLocation.map(s => ({
          id: s.id,
          target_date: formatDate(selectedDate),
          vehicle_id: s.vehicle_id,
          driver_id: s.driver_id,
          vehicle: { id: s.vehicle_id, capacity: s.vehicle?.capacity || 0, name: s.vehicle?.name || "不明" },
          driver: { id: s.driver_id, name: s.driver?.name || "不明" }
        })) as any[];

        const result = autoAssignVehicles({ attendances: currentAttendances as any[], shifts: inputShifts });

        const newColumns = result.columns.map((col: any) => {
          const originalCol = displayColumns.find(c => c.vehicleId === col.vehicleId);
          return {
            ...originalCol,
            trips: col.trips,
          };
        });

        console.log("=== 自動配車デバッグログ ===");
        console.log(\`対象児童総数: \${currentAttendances.length}人\`);
        result.columns.forEach(col => {
          const tripsLog = col.trips.map((t: any) => \`\${t.tripIndex}便: \${(t.children || []).length}人\`).join(", ");
          console.log(\`\${col.vehicleName} [\${tripsLog}]\`);
        });
        console.log(\`未割り当て残数: \${result.unassigned.length}人\`);
        console.log("============================");

        setBoard(activeTab, {
          columns: newColumns,
          unassigned: { id: "unassigned", children: result.unassigned },
        });
        setIsAutoAssigned(true);

        // 自動保存 (即座に実行)
        await performAutoSave();
`;

  content = content.substring(0, startIndex) + newBlock.trim() + content.substring(endIndex);
  fs.writeFileSync('app/board/page.tsx', content);
  console.log("handleAutoAssign updated successfully.");
} else {
  console.log("Could not find blocks to replace");
}
