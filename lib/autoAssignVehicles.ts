import {
  AssignInput,
  AssignResult,
  ChildMagnet,
  VehicleColumn,
} from "@/types";

// Helper: Get total minutes from HH:MM
function getMinutes(time: string | null): number {
  if (!time || !time.includes(':')) return 15 * 60; // Default to 15:00 if null/invalid
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
function canRideTogether(group: ChildMagnet[], newChildren: ChildMagnet[]): boolean {
  for (const nc of newChildren) {
    if (nc.unit_name) {
      for (const c of group) {
        if (c.unit_name && c.unit_name !== nc.unit_name) return false;
      }
    }
    
    const hasNG = (notes: string | null, targetName: string) => {
      if (!notes) return false;
      return notes.includes(`NG:${targetName}`) || 
             notes.includes(`NG: ${targetName}`) || 
             notes.includes(`NG ${targetName}`) ||
             notes.includes(`${targetName}NG`) ||
             notes.includes(`${targetName} NG`);
    };

    for (const c of group) {
      if (hasNG(c.notes, nc.name) || hasNG(nc.notes, c.name)) return false;
    }
  }
  return true;
}

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

  console.log(`\n[AutoAssign] 配車開始... 総出席児童: ${allMagnets.length}名`);

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

  const maxVehicleCapacity = Math.max(...columns.map(c => c.capacity), 1);

  // ==========================================
  // Step 1: 生徒の完全グループ化（クラスタ作成）
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
          // Rule: 同乗NGチェックのみ。定員による強制分割はここでは行わず、できる限り1つにまとめる。
          if (canRideTogether(group.children, [student])) {
            group.children.push(student);
            merged = true;
            break;
          }
        }
      }
      if (!merged) {
        currentGroups.push({
          id: `mg-${groupIdCounter++}`,
          school_name: schoolName,
          base_pickup_time: student.pickup_time,
          children: [student],
          tripIndex: getTripIndexFromTime(getMinutes(student.pickup_time))
        });
      }
    }
    
    // untimed students go to the largest group they can fit in, or a new group
    for (const student of untimedStudents) {
      let merged = false;
      const sortedByLargest = [...currentGroups].sort((a, b) => b.children.length - a.children.length);
      for (const group of sortedByLargest) {
        if (canRideTogether(group.children, [student])) {
          group.children.push(student);
          merged = true;
          break;
        }
      }
      if (!merged) {
        currentGroups.push({
          id: `mg-${groupIdCounter++}`,
          school_name: schoolName,
          base_pickup_time: "15:00",
          children: [student],
          tripIndex: getTripIndexFromTime(getMinutes("15:00"))
        });
      }
    }
    
    missionGroups.push(...currentGroups);
  }

  // コンソールログ出力（グループ一覧）
  console.log(`\n[AutoAssign] === 作成された学校クラスタ ===`);
  for (const g of missionGroups) {
      console.log(` - [${g.base_pickup_time}] ${g.school_name} : ${g.children.length}名`);
  }

  // Helpers
  function getOrAddTrip(col: VehicleColumn, tripIndex: number) {
    let trip = col.trips.find(t => t.tripIndex === tripIndex);
    if (!trip) {
      trip = { id: `${col.shiftId}-trip-${tripIndex}`, tripIndex, children: [] };
      col.trips.push(trip);
    }
    return trip;
  }
  
  function getAvailableSpace(col: VehicleColumn, tripIndex: number): number {
    const trip = col.trips.find(t => t.tripIndex === tripIndex);
    if (!trip) return col.capacity;
    return col.capacity - trip.children.length;
  }
  
  function getTripSchool(col: VehicleColumn, tripIndex: number): string | null {
      const trip = col.trips.find(t => t.tripIndex === tripIndex);
      if (!trip || trip.children.length === 0) return null;
      return trip.children[0].school_name;
  }

  function assignTo(col: VehicleColumn, tripIndex: number, children: ChildMagnet[]) {
      const trip = getOrAddTrip(col, tripIndex);
      trip.children.push(...children);
  }

  // ==========================================
  // Step 2 & 3: グループ単位での一括投入 (Bin Packing)
  // ==========================================
  
  // Sort groups by size descending (largest clusters first)
  missionGroups.sort((a, b) => b.children.length - a.children.length);

  for (const group of missionGroups) {
      let unassignedChildren = [...group.children];

      while (unassignedChildren.length > 0) {
          const size = unassignedChildren.length;
          const targetTrip = group.tripIndex;
          
          let minCap = 0, maxCap = 99;
          if (size >= 5) { minCap = 5; maxCap = 99; }
          else if (size >= 3) { minCap = 4; maxCap = 4; }
          else { minCap = 0; maxCap = 3; }

          let bestCol: VehicleColumn | null = null;
          let bestTrip = targetTrip;

          // Strategy 1: Perfect Size Match (Same school or Empty) in targetTrip
          if (!bestCol) {
              for (const col of columns) {
                  if (col.capacity >= minCap && col.capacity <= maxCap && getAvailableSpace(col, targetTrip) >= size) {
                      const school = getTripSchool(col, targetTrip);
                      if ((!school || school === group.school_name) && canRideTogether(col.trips.find(t=>t.tripIndex===targetTrip)?.children || [], unassignedChildren)) {
                          bestCol = col;
                          bestTrip = targetTrip;
                          break;
                      }
                  }
              }
          }

          // Strategy 2: Any Capacity Match (Same school or Empty) in targetTrip
          if (!bestCol) {
              for (const col of columns) {
                  if (getAvailableSpace(col, targetTrip) >= size) {
                      const school = getTripSchool(col, targetTrip);
                      if ((!school || school === group.school_name) && canRideTogether(col.trips.find(t=>t.tripIndex===targetTrip)?.children || [], unassignedChildren)) {
                          bestCol = col;
                          bestTrip = targetTrip;
                          break;
                      }
                  }
              }
          }

          // Strategy 3: Piston (Next Trip) Perfect Match (Same school or Empty) (if size >= 5)
          if (!bestCol && size >= 5 && targetTrip + 1 <= 4) {
              const nextTrip = targetTrip + 1;
              for (const col of columns) {
                  if (col.capacity >= minCap && col.capacity <= maxCap && getAvailableSpace(col, nextTrip) >= size) {
                      const school = getTripSchool(col, nextTrip);
                      if ((!school || school === group.school_name) && canRideTogether(col.trips.find(t=>t.tripIndex===nextTrip)?.children || [], unassignedChildren)) {
                          bestCol = col;
                          bestTrip = nextTrip;
                          break;
                      }
                  }
              }
          }

          // Strategy 4: Flexible Assignment (Any vehicle with enough space in targetTrip or next trip)
          if (!bestCol) {
              for (const tIndex of [targetTrip, targetTrip + 1].filter(t => t >= 1 && t <= 4)) {
                  let sortedCols = [...columns].sort((a,b) => getAvailableSpace(b, tIndex) - getAvailableSpace(a, tIndex));
                  for (const col of sortedCols) {
                      if (getAvailableSpace(col, tIndex) >= size && canRideTogether(col.trips.find(t=>t.tripIndex===tIndex)?.children || [], unassignedChildren)) {
                          bestCol = col;
                          bestTrip = tIndex;
                          break;
                      }
                  }
                  if (bestCol) break;
              }
          }

          // If found a vehicle that can take the ENTIRE remaining group, assign them all!
          if (bestCol) {
              assignTo(bestCol, bestTrip, unassignedChildren);
              unassignedChildren = [];
          } else {
              // Strategy 5: Splitting (Group size > max available capacity)
              // Find the vehicle with the LARGEST available space > 0
              let maxSpaceCol: VehicleColumn | null = null;
              let maxSpaceTrip = targetTrip;
              let maxSpace = 0;

              for (const tIndex of [targetTrip, targetTrip + 1, targetTrip - 1].filter(t => t >= 1 && t <= 4)) {
                  for (const col of columns) {
                      const space = getAvailableSpace(col, tIndex);
                      if (space > maxSpace && canRideTogether(col.trips.find(t=>t.tripIndex===tIndex)?.children || [], [unassignedChildren[0]])) {
                          maxSpace = space;
                          maxSpaceCol = col;
                          maxSpaceTrip = tIndex;
                      }
                  }
                  if (maxSpaceCol) break; // Found something in this preferred trip index
              }

              if (maxSpaceCol && maxSpace > 0) {
                  const toTakeCount = Math.min(unassignedChildren.length, maxSpace);
                  const toTake = unassignedChildren.splice(0, toTakeCount);
                  assignTo(maxSpaceCol, maxSpaceTrip, toTake);
              } else {
                  // Strategy 6: Force assign (All vehicles full, or NG restrictions prevent any matching)
                  // Find vehicle with least negative space (most empty)
                  let forcedCol = columns[0];
                  let forcedTrip = targetTrip;
                  let maxSpace = -999;
                  for (const col of columns) {
                      const space = getAvailableSpace(col, targetTrip);
                      if (space > maxSpace) {
                          maxSpace = space;
                          forcedCol = col;
                      }
                  }
                  const forcedChild = unassignedChildren.splice(0, 1)[0];
                  assignTo(forcedCol, forcedTrip, [forcedChild]);
              }
          }
      }
  }

  // ==========================================
  // Final Cleanup & Stats
  // ==========================================
  console.log(`\n[AutoAssign] === 各車両の便ごとのアサイン結果 ===`);
  for (const col of columns) {
    if (col.trips.length === 0) {
      col.trips.push({ id: `${col.shiftId}-trip-1`, tripIndex: 1, children: [] });
    }
    col.trips.sort((a, b) => a.tripIndex - b.tripIndex);

    const totalLoad = col.trips.reduce((acc, t) => acc + t.children.length, 0);
    const tripDetails = col.trips.map(t => {
      // Create a summary of schools in this trip
      const schools = t.children.map(c => c.school_name);
      const counts: Record<string, number> = {};
      for (const s of schools) counts[s] = (counts[s] || 0) + 1;
      const schoolSummary = Object.entries(counts).map(([name, count]) => `${name}:${count}名`).join(', ');
      
      return `${t.tripIndex}便(${t.children.length}人 [${schoolSummary || '空'}])`;
    }).join(' | ');
    
    console.log(` - ${col.vehicleName} (定員${col.capacity}): 計${totalLoad}人 -> ${tripDetails}`);
  }

  console.log(`\n【配車完了】総出席児童: ${allMagnets.length} 未割り当て: 0\n`);

  return { columns, unassigned: [] };
}
