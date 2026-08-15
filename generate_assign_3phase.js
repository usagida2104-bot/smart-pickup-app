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
 * 3段階配車アルゴリズム (未割り当てゼロ最優先)
 */
export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  const presentAttendances = attendances.filter(a => a.child && a.status !== "absent" && a.status !== "no_transport");
  
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

  console.log(\`\\n[AutoAssign] 配車開始... 総出席児童: \${allMagnets.length}名\`);

  // ==========================================
  // 前処理: クラスタリング
  // ==========================================
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
          base_pickup_time: "15:00",
          children: [student],
          tripIndex: getTripIndexFromTime(getMinutes("15:00"))
        });
      }
    }
    
    missionGroups.push(...currentGroups);
  }

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

  let unassigned: ChildMagnet[] = [];

  // ==========================================
  // Phase 1: 理想クラスタリング配車（同一校のみ）
  // ==========================================
  console.log(\`[AutoAssign] Phase 1 開始...\`);
  for (let currentTripIndex = 1; currentTripIndex <= 4; currentTripIndex++) {
    const groupsForTrip = missionGroups.filter(g => g.tripIndex === currentTripIndex);
    groupsForTrip.sort((a, b) => b.children.length - a.children.length);

    for (const group of groupsForTrip) {
      let unassignedFromGroup = [...group.children];

      while (unassignedFromGroup.length > 0) {
        let bestSlot: { col: VehicleColumn, tripIndex: number, capacity: number } | null = null;
        let targetTripIndex = currentTripIndex;
        let found = false;

        while (targetTripIndex <= 4 && !found) {
          for (const col of columns) {
            let existingTrip = col.trips.find(t => t.tripIndex === targetTripIndex);
            
            if (!existingTrip) {
              bestSlot = { col, tripIndex: targetTripIndex, capacity: col.capacity };
              found = true;
              break;
            } else {
              // Phase 1 制約: 同一学校のみ相乗り可
              if (existingTrip.children.length < col.capacity && existingTrip.children[0]?.school_name === group.school_name) {
                if (canRideTogether(existingTrip.children, unassignedFromGroup[0])) {
                  bestSlot = { col, tripIndex: targetTripIndex, capacity: col.capacity - existingTrip.children.length };
                  found = true;
                  break;
                }
              }
            }
          }
          if (!found) targetTripIndex++;
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
        } else {
          unassigned.push(...unassignedFromGroup);
          break;
        }
      }
    }
  }

  // ==========================================
  // Phase 2: 同時間帯の相乗り（学校違いを許可）
  // ==========================================
  if (unassigned.length > 0) {
    console.log(\`[AutoAssign] Phase 2 開始... 対象:\${unassigned.length}名\`);
    let phase2Unassigned: ChildMagnet[] = [];
    
    for (const child of unassigned) {
      const idealTripIndex = getTripIndexFromTime(getMinutes(child.pickup_time));
      let assigned = false;

      // その便(idealTripIndex)に空きがある車両を探す
      for (const col of columns) {
        let existingTrip = col.trips.find(t => t.tripIndex === idealTripIndex);
        if (!existingTrip) {
          // 全く空いている便
          const trip = { id: \`\${col.shiftId}-trip-\${idealTripIndex}\`, tripIndex: idealTripIndex, children: [child] };
          col.trips.push(trip);
          assigned = true;
          break;
        } else if (existingTrip.children.length < col.capacity) {
          // Phase 2: 学校が違ってもOKだが、NG制約は守る
          if (canRideTogether(existingTrip.children, child)) {
            existingTrip.children.push(child);
            assigned = true;
            break;
          }
        }
      }

      if (!assigned) {
        phase2Unassigned.push(child);
      }
    }
    unassigned = phase2Unassigned;
  }

  // ==========================================
  // Phase 3: 未割り当て完全ゼロ保証 (時間外も許可)
  // ==========================================
  if (unassigned.length > 0) {
    console.log(\`[AutoAssign] Phase 3 開始... 対象:\${unassigned.length}名\`);
    let phase3Unassigned: ChildMagnet[] = [];

    for (const child of unassigned) {
      let assigned = false;
      const idealTripIndex = getTripIndexFromTime(getMinutes(child.pickup_time));

      // 近い便から順に探す (ideal, then +1, -1, +2, -2...)
      const searchOrder = [idealTripIndex, idealTripIndex + 1, idealTripIndex - 1, idealTripIndex + 2, idealTripIndex - 2, 1, 2, 3, 4]
        .filter(t => t >= 1 && t <= 4); // 範囲外除外
      const uniqueOrder = [...new Set(searchOrder)];

      for (const tripIndex of uniqueOrder) {
        if (assigned) break;

        for (const col of columns) {
          let existingTrip = col.trips.find(t => t.tripIndex === tripIndex);
          if (!existingTrip) {
            const trip = { id: \`\${col.shiftId}-trip-\${tripIndex}\`, tripIndex, children: [child] };
            col.trips.push(trip);
            assigned = true;
            break;
          } else if (existingTrip.children.length < col.capacity) {
            // 制約は最後まで守る
            if (canRideTogether(existingTrip.children, child)) {
              existingTrip.children.push(child);
              assigned = true;
              break;
            }
          }
        }
      }

      if (!assigned) {
        phase3Unassigned.push(child);
      }
    }
    unassigned = phase3Unassigned;
  }

  // ==========================================
  // Final Cleanup & Stats
  // ==========================================
  // UI互換性のため、1便も作られなかった車両に空の1便目をセット
  for (const col of columns) {
    if (col.trips.length === 0) {
      col.trips.push({ id: \`\${col.shiftId}-trip-1\`, tripIndex: 1, children: [] });
    }
    // ソート (tripIndex昇順)
    col.trips.sort((a, b) => a.tripIndex - b.tripIndex);
  }

  const total = allMagnets.length;
  const assignedCount = total - unassigned.length;
  const unassignedCount = unassigned.length;
  
  console.log(\`【配車完了】総出席児童: \${total} 配車済み: \${assignedCount} 未割り当て残数: \${unassignedCount}\`);

  return { columns, unassigned };
}
`;

fs.writeFileSync('lib/autoAssignVehicles.ts', code);
console.log("Written 3-phase autoAssignVehicles.ts");
