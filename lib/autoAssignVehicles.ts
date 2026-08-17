import {
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
    return notes.includes(`NG:${targetName}`) || 
           notes.includes(`NG: ${targetName}`) || 
           notes.includes(`NG ${targetName}`) ||
           notes.includes(`${targetName}NG`) ||
           notes.includes(`${targetName} NG`);
  };

  for (const c of group) {
    if (hasNG(c.notes, newChild.name) || hasNG(newChild.notes, c.name)) return false;
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
          if (group.children.length < maxVehicleCapacity && canRideTogether(group.children, student)) {
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
    
    for (const student of untimedStudents) {
      let merged = false;
      const sortedByLargest = [...currentGroups].sort((a, b) => b.children.length - a.children.length);
      for (const group of sortedByLargest) {
        if (group.children.length < maxVehicleCapacity && canRideTogether(group.children, student)) {
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

  // ==========================================
  // Phase 1: 完全一致アサイン（人数規模 ➔ 車両サイズのマッチング）
  // ==========================================
  console.log(`[AutoAssign] Phase 1 開始...`);
  let unassignedGroups: MissionGroup[] = [];

  // Sort groups by size descending
  missionGroups.sort((a, b) => b.children.length - a.children.length);

  for (const group of missionGroups) {
    let assigned = false;
    const size = group.children.length;
    const targetTrip = group.tripIndex;
    
    // Determine ideal vehicle capacity range
    let minCap = 0, maxCap = 99;
    if (size >= 5) {
      minCap = 5; maxCap = 99; // Large
    } else if (size >= 3) {
      minCap = 4; maxCap = 4; // Medium
    } else {
      minCap = 0; maxCap = 3; // Small
    }

    let bestCol = null;
    let candidateCols = columns.filter(c => c.capacity >= minCap && c.capacity <= maxCap);
    
    // Try target trip index
    for (const col of candidateCols) {
       const space = getAvailableSpace(col, targetTrip);
       if (space >= size) {
           const existingSchool = getTripSchool(col, targetTrip);
           if (!existingSchool || existingSchool === group.school_name) {
               const trip = col.trips.find(t => t.tripIndex === targetTrip);
               let ng = false;
               if (trip) {
                   for (const c of group.children) {
                       if (!canRideTogether(trip.children, c)) ng = true;
                   }
               }
               if (!ng) {
                   bestCol = col;
                   break;
               }
           }
       }
    }
    
    // If not found, try targetTrip + 1 for large groups (Piston transport)
    if (!bestCol && size >= 5) {
        const nextTrip = targetTrip + 1;
        if (nextTrip <= 4) {
            for (const col of candidateCols) {
               const space = getAvailableSpace(col, nextTrip);
               if (space >= size) {
                   const trip = col.trips.find(t => t.tripIndex === nextTrip);
                   let ng = false;
                   if (trip) {
                       for (const c of group.children) {
                           if (!canRideTogether(trip.children, c)) ng = true;
                       }
                   }
                   if (!ng) {
                       bestCol = col;
                       group.tripIndex = nextTrip; // adjust target trip
                       break;
                   }
               }
            }
        }
    }

    if (bestCol) {
       const trip = getOrAddTrip(bestCol, group.tripIndex);
       trip.children.push(...group.children);
       assigned = true;
    } else {
       unassignedGroups.push(group);
    }
  }

  // ==========================================
  // Phase 2: 柔軟なアサイン（相乗り・空き枠の活用）
  // ==========================================
  console.log(`[AutoAssign] Phase 2 開始... 対象クラスタ: ${unassignedGroups.length}個`);
  let phase3Groups: MissionGroup[] = [];
  for (const group of unassignedGroups) {
      let assigned = false;
      const size = group.children.length;
      
      const searchTrips = [group.tripIndex, group.tripIndex + 1, group.tripIndex - 1, group.tripIndex + 2].filter(t => t >= 1 && t <= 4);
      
      for (const tIndex of searchTrips) {
          if (assigned) break;
          // Sort by remaining capacity descending
          const sortedCols = [...columns].sort((a, b) => getAvailableSpace(b, tIndex) - getAvailableSpace(a, tIndex));
          for (const col of sortedCols) {
              const space = getAvailableSpace(col, tIndex);
              if (space >= size) {
                   const trip = col.trips.find(t => t.tripIndex === tIndex);
                   let ng = false;
                   if (trip) {
                       for (const c of group.children) {
                           if (!canRideTogether(trip.children, c)) ng = true;
                       }
                   }
                   if (!ng) {
                       const actualTrip = getOrAddTrip(col, tIndex);
                       actualTrip.children.push(...group.children);
                       assigned = true;
                       break;
                   }
              }
          }
      }
      
      if (!assigned) {
          phase3Groups.push(group);
      }
  }

  // ==========================================
  // Phase 3: 未割り当てゼロ保証（フォールバック＆分割）
  // ==========================================
  let finalUnassigned: ChildMagnet[] = [];
  let flatUnassigned = phase3Groups.flatMap(g => g.children);
  
  if (flatUnassigned.length > 0) {
      console.log(`[AutoAssign] Phase 3 開始... 強制アサイン対象: ${flatUnassigned.length}名`);
      
      for (const child of flatUnassigned) {
          let assigned = false;
          const idealTrip = getTripIndexFromTime(getMinutes(child.pickup_time));
          const searchTrips = [idealTrip, idealTrip + 1, idealTrip - 1, idealTrip + 2, idealTrip - 2, 1, 2, 3, 4].filter(t => t >= 1 && t <= 4);
          const uniqueTrips = [...new Set(searchTrips)];
          
          // Step A: Find space without violating capacity or NG rules
          for (const tIndex of uniqueTrips) {
              if (assigned) break;
              const sortedCols = [...columns].sort((a, b) => getAvailableSpace(b, tIndex) - getAvailableSpace(a, tIndex));
              for (const col of sortedCols) {
                  if (getAvailableSpace(col, tIndex) >= 1) {
                       const trip = col.trips.find(t => t.tripIndex === tIndex);
                       let ng = false;
                       if (trip && !canRideTogether(trip.children, child)) ng = true;
                       
                       if (!ng) {
                           const actualTrip = getOrAddTrip(col, tIndex);
                           actualTrip.children.push(child);
                           assigned = true;
                           break;
                       }
                  }
              }
          }
          
          // Step B: Force assign (ignore capacity to guarantee 0 unassigned)
          if (!assigned) {
              let forced = false;
              for (const tIndex of uniqueTrips) {
                  if (forced) break;
                  // Sort by most space (or least negative space)
                  const sortedCols = [...columns].sort((a, b) => getAvailableSpace(b, tIndex) - getAvailableSpace(a, tIndex));
                  for (const col of sortedCols) {
                      const actualTrip = getOrAddTrip(col, tIndex);
                      actualTrip.children.push(child);
                      forced = true;
                      break; 
                  }
              }
              if (!forced) {
                 finalUnassigned.push(child); 
              }
          }
      }
  }

  // ==========================================
  // Final Cleanup & Stats
  // ==========================================
  console.log(`[AutoAssign] === 車両別 負荷状況 ===`);
  for (const col of columns) {
    if (col.trips.length === 0) {
      col.trips.push({ id: `${col.shiftId}-trip-1`, tripIndex: 1, children: [] });
    }
    col.trips.sort((a, b) => a.tripIndex - b.tripIndex);

    const totalLoad = col.trips.reduce((acc, t) => acc + t.children.length, 0);
    const tripDetails = col.trips.map(t => {
      const areas = [...new Set(t.children.map(c => c.school_area || '未設定'))].join(',');
      return `${t.tripIndex}便(${t.children.length}人 [エリア:${areas}])`;
    }).join(' | ');
    
    console.log(` - ${col.vehicleName} (定員${col.capacity}): 計${totalLoad}人 -> ${tripDetails}`);
  }

  const total = allMagnets.length;
  const assignedCount = total - finalUnassigned.length;
  const unassignedCount = finalUnassigned.length;
  
  console.log(`【配車完了】総出席児童: ${total} 配車済み: ${assignedCount} 未割り当て残数: ${unassignedCount}\n`);

  return { columns, unassigned: finalUnassigned };
}
