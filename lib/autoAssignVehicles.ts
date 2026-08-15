import {
  AssignInput,
  AssignResult,
  ChildMagnet,
  VehicleColumn,
} from "@/types";

function getTimeDiff(time1: string | null, time2: string | null) {
  if (!time1 || !time2) return 0;
  if (!time1.includes(':') || !time2.includes(':')) return 0;
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  return Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
}

/**
 * 自動配車ロジック (複数便対応)
 *
 * アルゴリズム:
 * 1. 出席（status === 'present'）の児童のみ対象
 * 2. pickup_timeでソート（早い順）
 * 3. 稼働車両をcapacity降順でソート
 * 4. 貪欲法: 同一学校・同一時間帯の児童を同じ車両に優先配置
 * 5. キャパシティを超えた場合、または時間差が40分以上の場合は、新規便(2便目, 3便目...)を作成
 * 6. 全車両が満員/上限便数に達した場合は未割り当てプールへ
 */
export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  // 出席者のみ抽出
  const presentAttendances = attendances.filter(
    (a) => a.child
  );

  // pickup_time でソート（nullは最後）
  const sorted = [...presentAttendances].sort((a, b) => {
    const getPickupTime = (att: typeof a) => {
      if (att.pickup_time && att.pickup_time.trim() !== "") return att.pickup_time;
      if (att.child?.default_dismissal_time && att.child.default_dismissal_time.trim() !== "") return att.child.default_dismissal_time;
      if (att.child?.school?.default_dismissal_time && att.child.school.default_dismissal_time.trim() !== "") return att.child.school.default_dismissal_time;
      return null;
    };
    
    const aTime = getPickupTime(a);
    const bTime = getPickupTime(b);

    if (!aTime && !bTime) return 0;
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime.localeCompare(bTime);
  });

  // 車両カラムを初期化（capacity降順）
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
      trips: [
        {
          id: `${shift.id}-trip-1`,
          tripIndex: 1,
          children: []
        }
      ],
    }));

  const unassigned: ChildMagnet[] = [];

  // 各児童を配車
  for (const attendance of sorted) {
    const child = attendance.child!;
    const magnet: ChildMagnet = {
      id: child.id,
      childId: child.id,
      name: child.name,
      color: child.school?.color_code ?? "#6B7280",
      has_caution: child.has_caution,
      pickup_time: (attendance.pickup_time && attendance.pickup_time.trim() !== "")
        ? attendance.pickup_time
        : (child.default_dismissal_time && child.default_dismissal_time.trim() !== "")
          ? child.default_dismissal_time
          : (child.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
            ? child.school.default_dismissal_time
            : null,
      school_name: child.school?.name ?? "",
      school_area: child.school?.area ?? null,
      unit_name: child.unit_name,
      notes: child.notes,
      transportMode: attendance.status,
    };

    let assigned = false;
    const allTrips = columns.flatMap(col => col.trips.map(trip => ({ col, trip })));

    // Pass 1: 同一エリア・時間差40分未満が既にいて、まだ空きがある便
    const pass1 = allTrips
      .filter(({ col, trip }) => 
        trip.children.length < col.capacity &&
        trip.children.some(c => 
          (
            (c.school_area && magnet.school_area && c.school_area === magnet.school_area) || 
            (!c.school_area && !magnet.school_area && c.school_name === magnet.school_name)
          ) && 
          getTimeDiff(c.pickup_time, magnet.pickup_time) < 40
        )
      )
      .sort((a, b) => {
        if (a.trip.children.length !== b.trip.children.length) return a.trip.children.length - b.trip.children.length;
        return b.col.capacity - a.col.capacity;
      });

    if (pass1.length > 0) {
      pass1[0].trip.children.push(magnet);
      assigned = true;
      continue;
    }

    // Pass 2: 空きがある便のうち、時間差が40分未満（または空）の便
    const pass2 = allTrips
      .filter(({ col, trip }) => 
        trip.children.length < col.capacity &&
        (trip.children.length === 0 || trip.children.some(c => getTimeDiff(c.pickup_time, magnet.pickup_time) < 40))
      )
      .sort((a, b) => {
        if (a.trip.children.length !== b.trip.children.length) return a.trip.children.length - b.trip.children.length;
        return b.col.capacity - a.col.capacity;
      });

    if (pass2.length > 0) {
      pass2[0].trip.children.push(magnet);
      assigned = true;
      continue;
    }

    // Pass 3: 空きがなく既存便にも入れない場合、新しく便を追加する（最大4便）
    const pass3 = columns
      .filter((col) => col.trips.length < 4)
      .sort((a, b) => {
        if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;
        return b.capacity - a.capacity;
      });

    if (pass3.length > 0) {
      const targetCol = pass3[0];
      const newTripIndex = targetCol.trips.length + 1;
      const newTrip = {
        id: `${targetCol.shiftId}-trip-${newTripIndex}`,
        tripIndex: newTripIndex,
        children: [magnet]
      };
      targetCol.trips.push(newTrip);
      assigned = true;
      continue;
    }

    // どこにも入れない場合は未割り当て
    if (!assigned) {
      unassigned.push(magnet);
    }
  }

  return { columns, unassigned };
}
