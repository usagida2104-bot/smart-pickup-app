const fs = require('fs');
let content = fs.readFileSync('app/board/page.tsx', 'utf8');

const startIndex = content.indexOf('const handleAutoAssign = async () => {');
const endIndex = content.indexOf('const performAutoSave = async () => {');

if (startIndex !== -1 && endIndex !== -1) {
  const originalBlock = content.substring(startIndex, endIndex);

  const newBlock = `const handleAutoAssign = async () => {
    setIsAutoAssigning(true);
    try {
      // 現在ボード上（カラム＋未割り当て）にいる児童を対象とする
      const allChildrenOnBoard = [
        ...(board.unassigned?.children || []),
        ...(board?.columns || []).flatMap((c: any) => (c.trips || []).flatMap((t: any) => t.children || []))
      ];

      const currentAttendances = allChildrenOnBoard.map((c: any) => ({
        id: c.id,
        child_id: c.id,
        status: c.transportMode,
        pickup_time: c.pickup_time,
        attendance_status: "present",
        child: children.find(masterC => masterC.id === c.id) || {
          id: c.id,
          name: c.name,
          has_caution: c.has_caution,
          notes: c.notes,
          school: { name: c.school_name, color_code: c.color, area: c.school_area },
        }
      }));

      if (currentAttendances.length === 0) {
        setIsAutoAssigning(false);
        return;
      }

      const inputShifts = displayColumns.map((col: any) => ({
        id: col.shiftId || col.id,
        target_date: formatDate(selectedDate),
        vehicle_id: col.vehicleId,
        driver_id: col.driverId,
        vehicle: { id: col.vehicleId, capacity: col.capacity, name: col.vehicleName },
        driver: { id: col.driverId, name: col.driverName }
      })) as any[];

      // APIを通さず、直接ローカルでアルゴリズムを実行（最大4便・下校時間順）
      const result = autoAssignVehicles({ attendances: currentAttendances as any[], shifts: inputShifts });

      const newColumns = result.columns.map((col: any) => {
        const originalCol = displayColumns.find((c: any) => c.vehicleId === col.vehicleId) || col;
        return {
          ...originalCol,
          trips: col.trips,
        };
      });

      // === デバッグ用コンソールログ ===
      console.log("=== 自動配車デバッグログ ===");
      console.log(\`対象児童総数: \${currentAttendances.length}人\`);
      newColumns.forEach((col: any) => {
        const tripsLog = (col.trips || []).map((t: any) => \`\${t.tripIndex}便: \${(t.children || []).length}人\`).join(", ");
        console.log(\`\${col.vehicleName} [\${tripsLog}]\`);
      });
      console.log(\`未割り当て残数: \${result.unassigned.length}人\`);
      console.log("============================");

      setBoard(activeTab, {
        columns: newColumns,
        unassigned: { id: "unassigned", children: result.unassigned },
      });
      setIsAutoAssigned(true);

      // 自動保存を確実に実行
      await performAutoSave();

    } catch (err: any) {
      console.error(err);
      alert(\`エラー: \${err.message}\`);
    } finally {
      setIsAutoAssigning(false);
    }
  };

  `;

  content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
  fs.writeFileSync('app/board/page.tsx', content);
  console.log("Replaced handleAutoAssign completely.");
} else {
  console.log("Could not find bounds");
}
