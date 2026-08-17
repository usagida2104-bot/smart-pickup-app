import {
  AssignInput,
  AssignResult,
  ChildMagnet,
  VehicleColumn,
  Trip
} from "@/types";

// Helper: Get total minutes from HH:MM
function getMinutes(time: string | null): number {
  if (!time || !time.includes(':')) return 15 * 60; // Default to 15:00 if null/invalid
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 15 * 60;
  return h * 60 + m;
}

function getTimeDiff(time1: string | null, time2: string | null): number {
  return Math.abs(getMinutes(time1) - getMinutes(time2));
}

// Clustering format
interface MissionGroup {
  id: string;
  school_name: string;
  base_pickup_time: string | null;
  children: ChildMagnet[];
}

interface InternalTrip {
  id: string;
  tripIndex: number;
  startTimeMinutes: number;
  children: ChildMagnet[];
}

interface InternalColumn extends VehicleColumn {
  internalTrips: InternalTrip[];
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
          children: [student]
        });
      }
    }
    
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
          children: [student]
        });
      }
    }
    
    missionGroups.push(...currentGroups);
  }

  // Sort groups: 1. Time ASC, 2. Size DESC
  missionGroups.sort((a, b) => {
    const timeA = getMinutes(a.base_pickup_time);
    const timeB = getMinutes(b.base_pickup_time);
    if (timeA !== timeB) return timeA - timeB;
    return b.children.length - a.children.length;
  });

  console.log(`\n[AutoAssign] === 作成された学校クラスタ（処理順） ===`);
  for (const g of missionGroups) {
      console.log(` - [${g.base_pickup_time}] ${g.school_name} : ${g.children.length}名`);
  }

  // ==========================================
  // Step 2: 車両の定員ソート
  // ==========================================
  const intColumns: InternalColumn[] = [...shifts]
    .map((shift) => ({
      id: shift.id,
      shiftId: shift.id,
      vehicleId: shift.vehicle_id,
      vehicleName: shift.vehicle?.name ?? "不明な車両",
      driverId: shift.driver_id,
      driverName: shift.driver?.name ?? "不明なドライバー",
      capacity: shift.vehicle?.capacity ?? 0,
      trips: [], 
      internalTrips: []
    }));

  // Sort vehicles by capacity DESC
  intColumns.sort((a, b) => b.capacity - a.capacity);

  function canVehicleTakeNewTrip(col: InternalColumn, time: number): boolean {
    if (col.internalTrips.length === 0) return true;
    const lastTrip = col.internalTrips[col.internalTrips.length - 1];
    return lastTrip.startTimeMinutes + 40 <= time;
  }

  // ==========================================
  // Step 3 & 4: アサインループ (Bin Packing + Sharing)
  // ==========================================
  
  for (const group of missionGroups) {
      let unassignedChildren = [...group.children];
      const groupTime = getMinutes(group.base_pickup_time);

      while (unassignedChildren.length > 0) {
          const size = unassignedChildren.length;
          let bestCol: InternalColumn | null = null;
          let bestExistingTrip: InternalTrip | null = null;
          let startNewTrip = false;

          // Strategy 1: Find an existing trip (Sharing)
          // Prefer trips with the same school first
          for (const col of intColumns) {
              if (col.internalTrips.length === 0) continue;
              const lastTrip = col.internalTrips[col.internalTrips.length - 1];
              if (Math.abs(lastTrip.startTimeMinutes - groupTime) <= 30) {
                  const space = col.capacity - lastTrip.children.length;
                  if (space >= size && canRideTogether(lastTrip.children, unassignedChildren)) {
                      const hasSameSchool = lastTrip.children.some(c => c.school_name === group.school_name);
                      if (hasSameSchool) {
                          bestCol = col;
                          bestExistingTrip = lastTrip;
                          break;
                      }
                  }
              }
          }

          // If no same school trip, check any school trip (Phase 4 相乗り強化)
          if (!bestCol) {
              for (const col of intColumns) {
                  if (col.internalTrips.length === 0) continue;
                  const lastTrip = col.internalTrips[col.internalTrips.length - 1];
                  if (Math.abs(lastTrip.startTimeMinutes - groupTime) <= 30) {
                      const space = col.capacity - lastTrip.children.length;
                      if (space >= size && canRideTogether(lastTrip.children, unassignedChildren)) {
                          bestCol = col;
                          bestExistingTrip = lastTrip;
                          break;
                      }
                  }
              }
          }

          // Strategy 2: Start a NEW trip
          if (!bestCol) {
              const findNewTripCol = (minC: number, maxC: number) => {
                  for (const col of intColumns) {
                      if (col.capacity >= minC && col.capacity <= maxC) {
                          if (canVehicleTakeNewTrip(col, groupTime)) {
                              return col;
                          }
                      }
                  }
                  return null;
              };

              // First prefer exactly matching sizes
              let minCap = 0, idealMaxCap = 99;
              if (size >= 5) { minCap = 5; idealMaxCap = 99; }
              else if (size >= 3) { minCap = 4; idealMaxCap = 4; }
              else { minCap = 0; idealMaxCap = 3; }

              bestCol = findNewTripCol(minCap, idealMaxCap);
              
              // Fallback to any larger vehicle
              if (!bestCol) {
                  bestCol = findNewTripCol(size, 99);
              }

              if (bestCol) {
                  startNewTrip = true;
              }
          }

          // Strategy 3: Split and force assign (if group > capacity, or all busy)
          if (!bestCol) {
              let maxSpaceCol: InternalColumn | null = null;
              let maxSpaceTrip: InternalTrip | null = null;
              let maxSpace = 0;

              for (const col of intColumns) {
                  // check existing trip with flex time (45 mins)
                  if (col.internalTrips.length > 0) {
                      const lastTrip = col.internalTrips[col.internalTrips.length - 1];
                      if (Math.abs(lastTrip.startTimeMinutes - groupTime) <= 45) {
                          const space = col.capacity - lastTrip.children.length;
                          if (space > maxSpace && canRideTogether(lastTrip.children, [unassignedChildren[0]])) {
                              maxSpace = space;
                              maxSpaceCol = col;
                              maxSpaceTrip = lastTrip;
                          }
                      }
                  }
                  
                  // check if we can start a new trip (even if capacity < size)
                  if (canVehicleTakeNewTrip(col, groupTime)) {
                      const space = col.capacity;
                      if (space > maxSpace) {
                          maxSpace = space;
                          maxSpaceCol = col;
                          maxSpaceTrip = null; // start new trip
                      }
                  }
              }

              if (maxSpaceCol && maxSpace > 0) {
                  const toTake = unassignedChildren.splice(0, maxSpace);
                  if (maxSpaceTrip) {
                      maxSpaceTrip.children.push(...toTake);
                  } else {
                      maxSpaceCol.internalTrips.push({
                          id: `temp`,
                          tripIndex: 0, // will be normalized later
                          startTimeMinutes: groupTime,
                          children: toTake
                      });
                  }
              } else {
                  // ALL vehicles full! Force overload the most empty existing trip.
                  let forcedCol = intColumns[0];
                  let maxSpaceFound = -999;
                  let forcedTrip = null;

                  for (const col of intColumns) {
                      if (col.internalTrips.length > 0) {
                          const lastTrip = col.internalTrips[col.internalTrips.length - 1];
                          const space = col.capacity - lastTrip.children.length;
                          if (space > maxSpaceFound) {
                              maxSpaceFound = space;
                              forcedCol = col;
                              forcedTrip = lastTrip;
                          }
                      }
                  }

                  const c = unassignedChildren.splice(0, 1)[0];
                  if (!forcedTrip) {
                      forcedTrip = { id: `temp`, tripIndex: 0, startTimeMinutes: groupTime, children: [] };
                      forcedCol.internalTrips.push(forcedTrip);
                  }
                  forcedTrip.children.push(c);
              }
          } else {
              // Successfully found a spot for the ENTIRE group
              if (startNewTrip) {
                  bestCol.internalTrips.push({
                      id: `temp`,
                      tripIndex: 0,
                      startTimeMinutes: groupTime,
                      children: unassignedChildren
                  });
              } else if (bestExistingTrip) {
                  bestExistingTrip.children.push(...unassignedChildren);
              }
              unassignedChildren = [];
          }
      }
  }

  // ==========================================
  // Step 5: 便番号の正規化 (Sequential Trip Indexing)
  // ==========================================
  console.log(`\n[AutoAssign] === 各車両の便ごとのアサイン結果 ===`);
  
  const finalColumns: VehicleColumn[] = intColumns.map(col => {
      // Sort trips chronologically just in case
      col.internalTrips.sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
      
      const trips: Trip[] = [];
      let currentTripIndex = 1;
      
      for (const intTrip of col.internalTrips) {
          if (intTrip.children.length === 0) continue; // Skip empty trips
          
          trips.push({
              id: `${col.shiftId}-trip-${currentTripIndex}`,
              tripIndex: currentTripIndex,
              children: intTrip.children
          });
          currentTripIndex++;
      }

      // Ensure at least 1 trip if completely empty (UI requirement)
      if (trips.length === 0) {
          trips.push({ id: `${col.shiftId}-trip-1`, tripIndex: 1, children: [] });
      }
      
      return {
          id: col.id,
          shiftId: col.shiftId,
          vehicleId: col.vehicleId,
          vehicleName: col.vehicleName,
          driverId: col.driverId,
          driverName: col.driverName,
          capacity: col.capacity,
          trips: trips
      };
  });

  for (const col of finalColumns) {
    const totalLoad = col.trips.reduce((acc, t) => acc + t.children.length, 0);
    const tripDetails = col.trips.map(t => {
      const schools = t.children.map(c => c.school_name);
      const counts: Record<string, number> = {};
      for (const s of schools) counts[s] = (counts[s] || 0) + 1;
      const schoolSummary = Object.entries(counts).map(([name, count]) => `${name}:${count}名`).join(', ');
      
      return `${t.tripIndex}便(${t.children.length}人 [${schoolSummary || '空'}])`;
    }).join(' | ');
    
    console.log(` - ${col.vehicleName} (定員${col.capacity}): 計${totalLoad}人 -> ${tripDetails}`);
  }

  console.log(`\n【配車完了】総出席児童: ${allMagnets.length} 未割り当て: 0\n`);

  return { columns: finalColumns, unassigned: [] };
}
