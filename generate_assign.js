const fs = require('fs');

const code = `import {
  AssignInput,
  AssignResult,
  ChildMagnet,
  VehicleColumn,
} from "@/types";

// Helper: Get total minutes from HH:MM
function getMinutes(time: string | null): number {
  if (!time || !time.includes(':')) return 15 * 60; // Default to 15:00 (900 mins) if null/invalid
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 15 * 60;
  return h * 60 + m;
}

// Helper: Absolute time difference
function getTimeDiff(time1: string | null, time2: string | null): number {
  return Math.abs(getMinutes(time1) - getMinutes(time2));
}

// Clustering format
interface MissionGroup {
  id: string;
  school_name: string;
  base_pickup_time: string | null;
  children: ChildMagnet[];
  tripIndex: number;
}

function getTripIndexFromTime(minutes: number): number {
  if (minutes <= 13 * 60 + 30) return 1; // 13:30以前 -> 1便目
  if (minutes <= 14 * 60 + 15) return 2; // 13:35 ~ 14:15 -> 2便目
  if (minutes <= 15 * 60) return 3;      // 14:20 ~ 15:00 -> 3便目
  return 4;                              // 15:05 以降 -> 4便目
}

// Constraints check
function canRideTogether(group: ChildMagnet[], newChild: ChildMagnet): boolean {
  if (newChild.unit_name) {
    for (const c of group) {
      if (c.unit_name && c.unit_name !== newChild.unit_name) {
        return false;
      }
    }
  }
  
  const hasNG = (notes: string | null, targetName: string) => {
    if (!notes) return false;
    return notes.includes(\`NG:\${targetName}\`) || 
           notes.includes(\`NG: \${targetName}\`) || 
           notes.includes(\`NG \${targetName}\`) ||
           notes.includes(\`\${targetName}NG\`) ||
           notes.includes(\`\${targetName} NG\`);
  };

  for (const c of group) {
    if (hasNG(c.notes, newChild.name) || hasNG(newChild.notes, c.name)) return false;
  }
  
  return true;
}

/**
 * 学校×時間帯のクラスタリング方式 ＆ 属性ベースキャパシティ最適化 自動配車ロジック
 */
export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  const presentAttendances = attendances.filter(a => a.child && a.status !== "absent" && a.status !== "no_transport");
  
  // Step 1: Extract magnets
  const allMagnets: ChildMagnet[] = presentAttendances.map(a => {
    const child = a.child!;
    return {
      id: child.id,
      childId: child.id,
      name: child.name,
      color: child.school?.color_code ?? "#6B7280",
      has_caution: child.has_caution,
      pickup_time: (a.pickup_time && a.pickup_time.trim() !== "")
        ? a.pickup_time
        : (child.default_dismissal_time && child.default_dismissal_time.trim() !== "")
          ? child.default_dismissal_time
          : (child.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
            ? child.school.default_dismissal_time
            : null,
      school_name: child.school?.name ?? "不明",
      school_area: child.school?.area ?? null,
      unit_name: child.unit_name,
      notes: child.notes,
      transportMode: a.status,
    };
  });

  console.log(\`\\n[AutoAssign] クラスタリング開始... 対象児童: \${allMagnets.length}名\`);

  // Step 2: 児童のクラスタリング (MissionGroup 化)
  const schoolGroups = new Map<string, ChildMagnet[]>();
  for (const mag of allMagnets) {
    if (!schoolGroups.has(mag.school_name)) schoolGroups.set(mag.school_name, []);
    schoolGroups.get(mag.school_name)!.push(mag);
  }

  const missionGroups: MissionGroup[] = [];
  let groupIdCounter = 1;

  for (const [schoolName, students] of schoolGroups.entries()) {
    const timedStudents = students.filter(s => s.pickup_time);
    const untimedStudents = students.filter(s => !s.pickup_time);
    
    timedStudents.sort((a, b) => getMinutes(a.pickup_time) - getMinutes(b.pickup_time));
    
    const currentGroups: MissionGroup[] = [];
    
    for (const student of timedStudents) {
      let merged = false;
      for (const group of currentGroups) {
        if (getTimeDiff(group.base_pickup_time, student.pickup_time) <= 15) {
          if (canRideTogether(group.children, student)) {
            group.children.push(student);
            merged = true;
            break;
          }
        }
      }
      if (!merged) {
        currentGroups.push({
          id: \`mg-\${groupIdCounter++}\`,
          school_name: schoolName,
          base_pickup_time: student.pickup_time,
          children: [student],
          tripIndex: getTripIndexFromTime(getMinutes(student.pickup_time))
        });
      }
    }
    
    for (const student of untimedStudents) {
      let merged = false;
      const sortedByLargest = [...currentGroups].sort((a, b) => b.children.length - a.children.length);
      for (const group of sortedByLargest) {
        if (canRideTogether(group.children, student)) {
          group.children.push(student);
          merged = true;
          break;
        }
      }
      if (!merged) {
        currentGroups.push({
          id: \`mg-\${groupIdCounter++}\`,
          school_name: schoolName,
          base_pickup_time: "15:00", // Default time
          children: [student],
          tripIndex: getTripIndexFromTime(getMinutes("15:00"))
        });
      }
    }
    
    missionGroups.push(...currentGroups);
  }

  missionGroups.forEach(mg => {
    console.log(\`[AutoAssign] クラスタ生成: \${mg.school_name} / \${mg.base_pickup_time} (\${mg.tripIndex}便目) / \${mg.children.length}名 -> \${mg.children.map(c => c.name).join(", ")}\`);
  });

  // Step 3 & 4: タイムラインの分類とキャパシティ最適化
  const columns: VehicleColumn[] = [...shifts]
    .sort((a, b) => (b.vehicle?.capacity ?? 0) - (a.vehicle?.capacity ?? 0))
    .map((shift) => ({
      id: shift.id,
      shiftId: shift.id,
      vehicleId: shift.vehicle_id,
      vehicleName: shift.vehicle?.name ?? "不明な車両",
      driverId: shift.driver_id,
      driverName: shift.driver?.name ?? "不明なドライバー",
      capacity: shift.vehicle?.capacity ?? 0,
      trips: [], 
    }));

  const unassigned: ChildMagnet[] = [];

  // 1便目から順番に処理する
  for (let currentTripIndex = 1; currentTripIndex <= 4; currentTripIndex++) {
    const groupsForTrip = missionGroups.filter(g => g.tripIndex === currentTripIndex);
    // 人数の多いクラスタから順に割り当てる（大型車を有効活用するため）
    groupsForTrip.sort((a, b) => b.children.length - a.children.length);

    for (const group of groupsForTrip) {
      let unassignedFromGroup = [...group.children];

      while (unassignedFromGroup.length > 0) {
        let bestSlot: { col: VehicleColumn, tripIndex: number, capacity: number } | null = null;

        // 車両の検索: 定員順(降順)にソートされているので先頭から探す
        // 大規模なら大型車、小規模なら中型・小型車を優先したいが、空きがない場合は大型も使う。
        // シンプルに「その便（TripIndex）がまだ空いている車両」を探す
        // ただし、「同一便には同一学校のみ」という制約があるため、
        // 既にその便が作られていて別学校なら相乗り不可。
        // 同じ学校なら相乗り可能。
        
        let targetTripIndex = currentTripIndex;
        let found = false;

        // フォールバック: 現在のTripIndexから順番に探す（定員超過時の次便への分割）
        while (targetTripIndex <= 4 && !found) {
          for (const col of columns) {
            let existingTrip = col.trips.find(t => t.tripIndex === targetTripIndex);
            
            if (!existingTrip) {
              // 全く空いているので新規便として割り当て可能
              bestSlot = { col, tripIndex: targetTripIndex, capacity: col.capacity };
              found = true;
              break;
            } else {
              // 既に便が存在する場合、同一学校・かつキャパ空き・相乗り制約クリアならOK
              if (existingTrip.children.length < col.capacity && existingTrip.children[0]?.school_name === group.school_name) {
                if (canRideTogether(existingTrip.children, unassignedFromGroup[0])) {
                  bestSlot = { col, tripIndex: targetTripIndex, capacity: col.capacity - existingTrip.children.length };
                  found = true;
                  break;
                }
              }
            }
          }
          if (!found) {
            targetTripIndex++; // 空きがなければ次便へフォールバック
          }
        }

        if (bestSlot) {
          const { col, tripIndex, capacity } = bestSlot;
          const toAssign = unassignedFromGroup.splice(0, capacity);
          
          let trip = col.trips.find(t => t.tripIndex === tripIndex);
          if (!trip) {
            trip = { id: \`\${col.shiftId}-trip-\${tripIndex}\`, tripIndex, children: [] };
            col.trips.push(trip);
          }
          trip.children.push(...toAssign);
          console.log(\`[AutoAssign] 割当: \${col.vehicleName} \${tripIndex}便目に \${toAssign.length}名 (\${group.school_name})\`);
        } else {
          // どの車両の、どの便（〜4便）にも全く空きがない場合
          console.warn(\`[AutoAssign] キャパシティ完全超過: \${unassignedFromGroup.length}名を未割り当てに移行 (\${group.school_name})\`);
          unassigned.push(...unassignedFromGroup);
          break; // このグループの残りは諦める
        }
      }
    }
  }

  // 1便も作られなかった車両があれば、UI互換性のために空の1便目をセット
  for (const col of columns) {
    if (col.trips.length === 0) {
      col.trips.push({ id: \`\${col.shiftId}-trip-1\`, tripIndex: 1, children: [] });
    }
  }

  console.log(\`[AutoAssign] 完了: 割り当て成功 \${allMagnets.length - unassigned.length}名, 未割り当て \${unassigned.length}名\\n\`);
  
  return { columns, unassigned };
}
`;

fs.writeFileSync('lib/autoAssignVehicles.ts', code);
console.log("Written autoAssignVehicles.ts");
