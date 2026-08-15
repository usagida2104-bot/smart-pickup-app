import {
  AssignInput,
  AssignResult,
  ChildMagnet,
  VehicleColumn,
} from "@/types";

// Helper: Get total minutes from HH:MM
function getMinutes(time: string | null): number {
  if (!time || !time.includes(':')) return 9999; // Null/Invalid -> arbitrarily large (end of day)
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 9999;
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
}

// Constraints check
function canRideTogether(group: ChildMagnet[], newChild: ChildMagnet): boolean {
  // 1. Check unit_name
  if (newChild.unit_name) {
    for (const c of group) {
      if (c.unit_name && c.unit_name !== newChild.unit_name) {
        return false;
      }
    }
  }
  
  // 2. Check notes for simple "NG" text
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

/**
 * 学校×時間帯のクラスタリング方式 自動配車ロジック
 */
export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  const presentAttendances = attendances.filter(a => a.child && a.status !== "absent" && a.status !== "no_transport");
  
  // Extract magnets
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

  console.log(`\n[AutoAssign] クラスタリング開始... 対象児童: ${allMagnets.length}名`);

  // ============================================================================
  // Step 1: 児童のクラスタリング (MissionGroup 化)
  // ============================================================================
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
    
    // 時間が早い順にソート
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
          id: `mg-${groupIdCounter++}`,
          school_name: schoolName,
          base_pickup_time: student.pickup_time,
          children: [student]
        });
      }
    }
    
    // 時間未設定の児童は、最大のグループにマージするか、単独グループ
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
          id: `mg-${groupIdCounter++}`,
          school_name: schoolName,
          base_pickup_time: null,
          children: [student]
        });
      }
    }
    
    missionGroups.push(...currentGroups);
  }

  // 時間順にグループを並び替え
  missionGroups.sort((a, b) => getMinutes(a.base_pickup_time) - getMinutes(b.base_pickup_time));

  missionGroups.forEach(mg => {
    console.log(`[AutoAssign] クラスタ生成: ${mg.school_name} / ${mg.base_pickup_time || "時間未設定"} / ${mg.children.length}名 -> ${mg.children.map(c => c.name).join(", ")}`);
  });

  // ============================================================================
  // Step 2: タイムライン割り当て (1便〜4便)
  // ============================================================================
  
  // カラムの初期化（キャパ降順）
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
      trips: [], // 初期は空。必要に応じてpush
    }));

  const unassigned: ChildMagnet[] = [];

  for (const group of missionGroups) {
    let unassignedFromGroup = [...group.children];
    
    while (unassignedFromGroup.length > 0) {
      let bestSlot: { col: VehicleColumn, tripIndex: number, capacity: number } | null = null;
      
      // 車両を探す (Option A: 新規車両の1便目優先、ダメなら既存の次便)
      // 1. 全く空いている車両（1便目が作れる）を優先的に探す
      for (const col of columns) {
        const currentTripCount = col.trips.length;
        if (currentTripCount === 0) {
          bestSlot = { col, tripIndex: 1, capacity: col.capacity };
          break; // 最高条件なので即決
        }
      }

      // 2. 空き車両がない場合、稼働中の便の相乗り、または次便（2便、3便）を検討
      if (!bestSlot) {
        for (const col of columns) {
          const currentTripCount = col.trips.length;
          const lastTrip = col.trips[currentTripCount - 1];
          const lastTripChildren = lastTrip.children;
          
          // 2-a. 直前の便と同じグループで、まだキャパが余っていれば相乗り
          if (lastTripChildren.length < col.capacity && lastTripChildren.length > 0) {
            const isSameSchool = lastTripChildren[0].school_name === group.school_name;
            const isNearTime = getTimeDiff(lastTripChildren[0].pickup_time, group.base_pickup_time) <= 15;
            
            if (isSameSchool && isNearTime && canRideTogether(lastTripChildren, group.children[0])) {
              bestSlot = { col, tripIndex: currentTripCount, capacity: col.capacity - lastTripChildren.length };
              break;
            }
          }

          // 2-b. 次便（ピストン輸送）が作れるかチェック（前の便から30分以上空いているか）
          if (currentTripCount < 4) {
            const lastTripTime = lastTripChildren[0]?.pickup_time || null;
            const minsPassed = getMinutes(group.base_pickup_time) - getMinutes(lastTripTime);
            
            // 30分経過している、または時間の概念がない場合は便を分ける
            if (minsPassed >= 30 || minsPassed < -600 || !group.base_pickup_time) {
              if (!bestSlot || bestSlot.tripIndex > currentTripCount + 1) {
                bestSlot = { col, tripIndex: currentTripCount + 1, capacity: col.capacity };
              }
            }
          }
        }
      }

      if (bestSlot) {
        const { col, tripIndex, capacity } = bestSlot;
        const toAssign = unassignedFromGroup.splice(0, capacity);
        
        let trip = col.trips.find(t => t.tripIndex === tripIndex);
        if (!trip) {
          trip = { id: `${col.shiftId}-trip-${tripIndex}`, tripIndex, children: [] };
          col.trips.push(trip);
        }
        trip.children.push(...toAssign);
      } else {
        // どの車両もキャパオーバー、かつ便も上限（4便）に達している
        console.warn(`[AutoAssign] キャパシティ超過: ${unassignedFromGroup.length}名を未割り当てに移行`);
        unassigned.push(...unassignedFromGroup);
        break;
      }
    }
  }

  // もし1便も作られなかった車両があれば、空の1便目をセット（UI互換性のため）
  for (const col of columns) {
    if (col.trips.length === 0) {
      col.trips.push({ id: `${col.shiftId}-trip-1`, tripIndex: 1, children: [] });
    }
  }

  console.log(`[AutoAssign] 完了: 割り当て成功 ${allMagnets.length - unassigned.length}名, 未割り当て ${unassigned.length}名\n`);
  
  return { columns, unassigned };
}
