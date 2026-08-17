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

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getTimeDiff(time1: string | null, time2: string | null): number {
  return Math.abs(getMinutes(time1) - getMinutes(time2));
}

function getTravelTime(schoolA: string, areaA: string | null, schoolB: string, areaB: string | null): number {
    if (schoolA === schoolB) return 0;
    if (areaA && areaB && areaA === areaB) return 10;
    return 20; // Default to 20 if different areas or area is unknown
}

// Clustering format
interface MissionGroup {
  id: string;
  school_name: string;
  base_pickup_time: string | null;
  children: ChildMagnet[];
}

interface RouteStop {
  timeMinutes: number;
  schoolName: string;
  area: string | null;
  children: ChildMagnet[];
}

interface InternalTrip {
  id: string;
  tripIndex: number;
  startTimeMinutes: number;
  stops: RouteStop[];
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
          base_pickup_time: "15:00", // Default if none
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

  intColumns.sort((a, b) => b.capacity - a.capacity);

  function canStartNewTrip(col: InternalColumn, time: number): boolean {
    if (col.internalTrips.length === 0) return true;
    const lastTrip = col.internalTrips[col.internalTrips.length - 1];
    if (lastTrip.stops.length === 0) return true;
    const lastStop = lastTrip.stops[lastTrip.stops.length - 1];
    // 1便目の完了から次便への出動は、最後のピックアップ時刻から +30分 と仮定
    return lastStop.timeMinutes + 30 <= time;
  }

  function canAppendToTrip(trip: InternalTrip, groupTime: number, school: string, area: string | null): boolean {
    if (trip.stops.length === 0) return true;
    const lastStop = trip.stops[trip.stops.length - 1];
    const travelTime = getTravelTime(lastStop.schoolName, lastStop.area, school, area);
    return lastStop.timeMinutes + travelTime <= groupTime;
  }

  // ==========================================
  // Step 3 & 4: アサインループ (Physical Routing & Bin Packing)
  // ==========================================
  
  let finalUnassigned: ChildMagnet[] = [];

  for (const group of missionGroups) {
      let unassignedChildren = [...group.children];
      const groupTime = getMinutes(group.base_pickup_time);
      const groupSchool = group.school_name;
      const groupArea = group.children[0].school_area ?? null;

      while (unassignedChildren.length > 0) {
          const size = unassignedChildren.length;
          let bestCol: InternalColumn | null = null;
          let appendToTrip: InternalTrip | null = null;
          let startNewTrip = false;
          let takeCount = 0;

          // Strategy 1: Find an existing trip (Multi-pickup) that can take EVERYONE
          for (const col of intColumns) {
              if (col.internalTrips.length === 0) continue;
              const lastTrip = col.internalTrips[col.internalTrips.length - 1];
              const currentCount = lastTrip.stops.reduce((acc, s) => acc + s.children.length, 0);
              const space = col.capacity - currentCount;
              
              if (space >= size) {
                  const allExistingChildren = lastTrip.stops.flatMap(s => s.children);
                  if (canRideTogether(allExistingChildren, unassignedChildren)) {
                      if (canAppendToTrip(lastTrip, groupTime, groupSchool, groupArea)) {
                          const lastStop = lastTrip.stops[lastTrip.stops.length - 1];
                          if (lastStop.schoolName === groupSchool) {
                              bestCol = col;
                              appendToTrip = lastTrip;
                              takeCount = size;
                              break;
                          } else if (!bestCol) { // Save first valid if not same school
                              bestCol = col;
                              appendToTrip = lastTrip;
                              takeCount = size;
                          }
                      }
                  }
              }
          }

          // Strategy 2: Start a NEW trip that can take EVERYONE
          if (!bestCol) {
              const findNewTripCol = (minC: number, maxC: number) => {
                  for (const col of intColumns) {
                      if (col.capacity >= minC && col.capacity <= maxC) {
                          if (canStartNewTrip(col, groupTime)) {
                              return col;
                          }
                      }
                  }
                  return null;
              };

              let minCap = 0, idealMaxCap = 99;
              if (size >= 5) { minCap = 5; idealMaxCap = 99; }
              else if (size >= 3) { minCap = 4; idealMaxCap = 4; }
              else { minCap = 0; idealMaxCap = 3; }

              bestCol = findNewTripCol(minCap, idealMaxCap);
              
              if (!bestCol) {
                  bestCol = findNewTripCol(size, 99);
              }

              if (bestCol) {
                  startNewTrip = true;
                  takeCount = size;
              }
          }

          // Strategy 3: Split (We cannot fit EVERYONE, find the largest space available)
          if (!bestCol) {
              let maxSpaceCol: InternalColumn | null = null;
              let maxSpaceTrip: InternalTrip | null = null;
              let maxSpace = 0;

              for (const col of intColumns) {
                  // Check existing trips
                  if (col.internalTrips.length > 0) {
                      const lastTrip = col.internalTrips[col.internalTrips.length - 1];
                      const space = col.capacity - lastTrip.stops.reduce((acc, s) => acc + s.children.length, 0);
                      
                      if (space > maxSpace && canRideTogether(lastTrip.stops.flatMap(s=>s.children), [unassignedChildren[0]])) {
                          if (canAppendToTrip(lastTrip, groupTime, groupSchool, groupArea)) {
                              maxSpace = space;
                              maxSpaceCol = col;
                              maxSpaceTrip = lastTrip;
                          }
                      }
                  }
                  
                  // Check new trips
                  if (canStartNewTrip(col, groupTime)) {
                      if (col.capacity > maxSpace) {
                          maxSpace = col.capacity;
                          maxSpaceCol = col;
                          maxSpaceTrip = null; // start new trip
                      }
                  }
              }

              if (maxSpaceCol && maxSpace > 0) {
                  bestCol = maxSpaceCol;
                  if (maxSpaceTrip) {
                      appendToTrip = maxSpaceTrip;
                  } else {
                      startNewTrip = true;
                  }
                  takeCount = Math.min(size, maxSpace);
              }
          }

          if (bestCol && takeCount > 0) {
              const toTake = unassignedChildren.splice(0, takeCount);
              
              if (startNewTrip) {
                  bestCol.internalTrips.push({
                      id: `temp`,
                      tripIndex: 0,
                      startTimeMinutes: groupTime,
                      stops: [{
                          timeMinutes: groupTime,
                          schoolName: groupSchool,
                          area: groupArea,
                          children: toTake
                      }]
                  });
              } else if (appendToTrip) {
                  const lastStop = appendToTrip.stops[appendToTrip.stops.length - 1];
                  // If same school and exactly same time, just append children to that stop
                  if (lastStop.schoolName === groupSchool && lastStop.timeMinutes === groupTime) {
                      lastStop.children.push(...toTake);
                  } else {
                      appendToTrip.stops.push({
                          timeMinutes: groupTime,
                          schoolName: groupSchool,
                          area: groupArea,
                          children: toTake
                      });
                  }
              }
          } else {
              // Strategy 4: Fallback
              // NO VEHICLE HAS SPACE, OR NO VEHICLE CAN REACH IN TIME.
              // Push to unassigned to NEVER create overcapacity
              finalUnassigned.push(...unassignedChildren);
              unassignedChildren = [];
              break;
          }
      }
  }

  // ==========================================
  // Step 5: 便番号の正規化 (Sequential Trip Indexing) & Console Logs
  // ==========================================
  console.log(`\n[AutoAssign] === ルート検証と各車両のアサイン結果 ===`);
  
  const finalColumns: VehicleColumn[] = intColumns.map(col => {
      col.internalTrips.sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);
      
      const trips: Trip[] = [];
      let currentTripIndex = 1;
      let routeLogs = [];
      let totalChildren = 0;

      for (const intTrip of col.internalTrips) {
          if (intTrip.stops.length === 0) continue;
          
          const allChildrenInTrip = intTrip.stops.flatMap(s => s.children);
          if (allChildrenInTrip.length === 0) continue;

          trips.push({
              id: `${col.shiftId}-trip-${currentTripIndex}`,
              tripIndex: currentTripIndex,
              children: allChildrenInTrip
          });
          
          totalChildren += allChildrenInTrip.length;

          // Build Route Log
          let routeStr = `${currentTripIndex}便目 [`;
          for (let i = 0; i < intTrip.stops.length; i++) {
              const stop = intTrip.stops[i];
              const timeStr = formatTime(stop.timeMinutes);
              routeStr += `${timeStr} ${stop.schoolName}(${stop.children.length}名)`;
              
              if (i < intTrip.stops.length - 1) {
                  const nextStop = intTrip.stops[i+1];
                  const travelTime = getTravelTime(stop.schoolName, stop.area, nextStop.schoolName, nextStop.area);
                  const actualWait = nextStop.timeMinutes - stop.timeMinutes;
                  routeStr += ` ➔ (移動${travelTime}分/待機${actualWait - travelTime}分) ➔ `;
              }
          }
          routeStr += `]`;
          routeLogs.push(routeStr);

          currentTripIndex++;
      }

      if (trips.length === 0) {
          trips.push({ id: `${col.shiftId}-trip-1`, tripIndex: 1, children: [] });
      }
      
      console.log(` - ${col.vehicleName} (定員${col.capacity}): 計${totalChildren}人`);
      if (routeLogs.length > 0) {
         for (const log of routeLogs) {
             console.log(`     ${log}`);
         }
      } else {
         console.log(`     (運行なし)`);
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

  console.log(`\n【配車完了】総出席児童: ${allMagnets.length} 未割り当て: ${finalUnassigned.length}\n`);

  return { columns: finalColumns, unassigned: finalUnassigned };
}
