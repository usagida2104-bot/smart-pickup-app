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

function canRideTogetherPhase2(group: ChildMagnet[], newChild: ChildMagnet): boolean {
  if (!canRideTogether(group, newChild)) return false;
  
  // Area check
  const existingAreaChild = group.find(c => c.school_area);
  if (existingAreaChild && newChild.school_area) {
    if (existingAreaChild.school_area !== newChild.school_area) return false;
  }
  
  return true;
}

/**
 * 負荷分散＆エリア考慮 3段階配車アルゴリズム
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

  // スコアリングに基づく最適なスロット検索
  function findBestSlot(
    unassignedCount: number,
    targetTripIndex: number,
    phase: number,
    groupSchool: string | null,
    childToAssign: ChildMagnet
  ) {
    const options = [];
    
    for (const col of columns) {
      let existingTrip = col.trips.find(t => t.tripIndex === targetTripIndex);
      let availableSpace = col.capacity;
      
      if (existingTrip) {
        availableSpace = col.capacity - existingTrip.children.length;
        if (availableSpace <= 0) continue;

        if (phase === 1) {
          if (existingTrip.children[0]?.school_name !== groupSchool) continue;
          if (!canRideTogether(existingTrip.children, childToAssign)) continue;
        } else if (phase === 2) {
          if (!canRideTogetherPhase2(existingTrip.children, childToAssign)) continue;
        } else if (phase === 3) {
          if (!canRideTogether(existingTrip.children, childToAssign)) continue;
        }
      }

      const possibleAssign = Math.min(unassignedCount, availableSpace);
      const totalLoad = col.trips.reduce((acc, t) => acc + t.children.length, 0);

      options.push({ col, possibleAssign, totalLoad, capacity: col.capacity, existingTrip });
    }

    if (options.length === 0) return null;

    options.sort((a, b) => {
      if (b.possibleAssign !== a.possibleAssign) return b.possibleAssign - a.possibleAssign;
      if (a.totalLoad !== b.totalLoad) return a.totalLoad - b.totalLoad;
      return b.capacity - a.capacity;
    });

    return {
      col: options[0].col,
      capacity: options[0].possibleAssign
    };
  }

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
        let bestSlot = findBestSlot(
          unassignedFromGroup.length,
          currentTripIndex,
          1,
          group.school_name,
          unassignedFromGroup[0]
        );

        if (bestSlot) {
          const { col, capacity } = bestSlot;
          const toAssign = unassignedFromGroup.splice(0, capacity);
          let trip = col.trips.find(t => t.tripIndex === currentTripIndex);
          if (!trip) {
            trip = { id: \`\${col.shiftId}-trip-\${currentTripIndex}\`, tripIndex: currentTripIndex, children: [] };
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
  // Phase 2: 同時間帯の相乗り（同一エリアの学校のみ）
  // ==========================================
  if (unassigned.length > 0) {
    console.log(\`[AutoAssign] Phase 2 開始... 対象:\${unassigned.length}名\`);
    let phase2Unassigned: ChildMagnet[] = [];
    
    for (const child of unassigned) {
      const idealTripIndex = getTripIndexFromTime(getMinutes(child.pickup_time));
      
      let bestSlot = findBestSlot(
        1,
        idealTripIndex,
        2,
        null,
        child
      );

      if (bestSlot) {
        const { col } = bestSlot;
        let trip = col.trips.find(t => t.tripIndex === idealTripIndex);
        if (!trip) {
          trip = { id: \`\${col.shiftId}-trip-\${idealTripIndex}\`, tripIndex: idealTripIndex, children: [] };
          col.trips.push(trip);
        }
        trip.children.push(child);
      } else {
        phase2Unassigned.push(child);
      }
    }
    unassigned = phase2Unassigned;
  }

  // ==========================================
  // Phase 3: 未割り当て完全ゼロ保証 (時間外・エリア外も許可)
  // ==========================================
  if (unassigned.length > 0) {
    console.log(\`[AutoAssign] Phase 3 開始... 対象:\${unassigned.length}名\`);
    let phase3Unassigned: ChildMagnet[] = [];

    for (const child of unassigned) {
      let assigned = false;
      const idealTripIndex = getTripIndexFromTime(getMinutes(child.pickup_time));

      // 近い便から順に探す
      const searchOrder = [idealTripIndex, idealTripIndex + 1, idealTripIndex - 1, idealTripIndex + 2, idealTripIndex - 2, 1, 2, 3, 4]
        .filter(t => t >= 1 && t <= 4);
      const uniqueOrder = [...new Set(searchOrder)];

      for (const tripIndex of uniqueOrder) {
        if (assigned) break;

        let bestSlot = findBestSlot(
          1,
          tripIndex,
          3,
          null,
          child
        );

        if (bestSlot) {
          const { col } = bestSlot;
          let trip = col.trips.find(t => t.tripIndex === tripIndex);
          if (!trip) {
            trip = { id: \`\${col.shiftId}-trip-\${tripIndex}\`, tripIndex, children: [] };
            col.trips.push(trip);
          }
          trip.children.push(child);
          assigned = true;
          break;
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
  console.log(\`[AutoAssign] === 車両別 負荷状況 ===\`);
  for (const col of columns) {
    if (col.trips.length === 0) {
      col.trips.push({ id: \`\${col.shiftId}-trip-1\`, tripIndex: 1, children: [] });
    }
    col.trips.sort((a, b) => a.tripIndex - b.tripIndex);

    const totalLoad = col.trips.reduce((acc, t) => acc + t.children.length, 0);
    const tripDetails = col.trips.map(t => {
      const areas = [...new Set(t.children.map(c => c.school_area || '未設定'))].join(',');
      return \`\${t.tripIndex}便(\${t.children.length}人 [エリア:\${areas}])\`;
    }).join(' | ');
    
    console.log(\` - \${col.vehicleName} (定員\${col.capacity}): 計\${totalLoad}人 -> \${tripDetails}\`);
  }

  const total = allMagnets.length;
  const assignedCount = total - unassigned.length;
  const unassignedCount = unassigned.length;
  
  console.log(\`【配車完了】総出席児童: \${total} 配車済み: \${assignedCount} 未割り当て残数: \${unassignedCount}\\n\`);

  return { columns, unassigned };
}
`;

fs.writeFileSync('lib/autoAssignVehicles.ts', code);
console.log("Written round-robin autoAssignVehicles.ts");
