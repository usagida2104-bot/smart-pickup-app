import { AssignInput, AssignResult, VehicleColumn, ChildMagnet } from "@/types";

export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  const presentAttendances = attendances.filter(a => a.child && a.status !== "absent" && a.status !== "no_transport");
  
  const allMagnets: any[] = presentAttendances.map(a => {
    const child = a.child!;
    const time = (a.pickup_time && a.pickup_time.trim() !== "")
        ? a.pickup_time
        : (child.default_dismissal_time && child.default_dismissal_time.trim() !== "")
          ? child.default_dismissal_time
          : (child.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
            ? child.school.default_dismissal_time
            : null;
            
    return {
      id: child.id,
      childId: child.id,
      name: child.name,
      color: child.school?.color_code ?? "#6B7280",
      has_caution: child.has_caution,
      pickup_time: time,
      school_name: child.school?.name ?? "不明",
      school_area: child.school?.area ?? null,
      unit_name: child.unit_name,
      notes: child.notes,
      transportMode: a.status,
      // For user code compatibility
      schoolName: child.school?.name ?? "不明",
      time: time,
    };
  });

  const columns: any[] = [...shifts].map((shift) => ({
      id: shift.id,
      shiftId: shift.id,
      vehicleId: shift.vehicle_id,
      vehicleName: shift.vehicle?.name ?? "不明な車両",
      driverId: shift.driver_id,
      driverName: shift.driver?.name ?? "不明なドライバー",
      capacity: shift.vehicle?.capacity ?? 0,
      trips: [], 
  }));

  // ============================================
  // 以下、ご提供いただいたロジックを完全適応
  // ============================================

  // 1. 車両の初期化とソート（定員の大きい順）
  const sortedCols = [...columns]
    .map(col => ({ ...col, trips: [] }))
    .sort((a, b) => (b.capacity || 0) - (a.capacity || 0));

  // 時間を分に変換するヘルパー関数
  const parseTime = (t: string) => {
    if (!t || t === '-') return 9999;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // 2. 児童を「学校×時間」でグループ化
  const groupsMap: Record<string, any[]> = {};
  for (const m of allMagnets) {
    const key = `${m.schoolName || '不明'}::${m.time || '-'}`;
    if (!groupsMap[key]) groupsMap[key] = [];
    groupsMap[key].push(m);
  }

  // 3. グループのソート（①時間が早い順 ➔ ②人数が多い順）
  // 13:30などの早い時間が、優先的に大型車を確保できるようにする
  const groups = Object.values(groupsMap).sort((a, b) => {
    const timeA = parseTime(a[0].time);
    const timeB = parseTime(b[0].time);
    if (timeA !== timeB) return timeA - timeB;
    return b.length - a.length;
  });

  let unassigned: any[] = [];

  // 4. 配車・はしご（相乗り）アサイン
  for (const group of groups) {
    let remaining = [...group];
    const gTime = parseTime(remaining[0].time);

    while (remaining.length > 0) {
      let placed = false;

      // パターンA: 既存の便に空きがあり、かつ時間差が「30分以内」なら相乗り（はしご）させる
      for (const col of sortedCols) {
        for (const trip of col.trips) {
          const tripTime = parseTime(trip.children[0]?.time);
          if (trip.children.length < col.capacity && Math.abs(tripTime - gTime) <= 30) {
            const space = col.capacity - trip.children.length;
            const chunk = remaining.splice(0, space);
            trip.children.push(...chunk);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (placed) continue;

      // パターンB: はしごできない場合は、定員が大きい空き車両に新しい便を作る
      let bestCol = sortedCols.find(col => col.trips.length < 4);
      if (bestCol) {
        const chunk = remaining.splice(0, bestCol.capacity);
        bestCol.trips.push({ children: chunk });
        placed = true;
      } else {
        // 車が足りない場合は一旦未割り当てへ
        unassigned.push(...remaining);
        remaining = [];
      }
    }
  }

  // 5. スイーパー処理（未割り当ての強制回収）
  const finalUnassigned: any[] = [];
  for (const child of unassigned) {
    let placed = false;
    for (const col of sortedCols) {
      for (const trip of col.trips) {
        if (trip.children.length < col.capacity) {
          trip.children.push(child);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      const bestCol = sortedCols.find(c => c.trips.length < 4);
      if (bestCol) {
        bestCol.trips.push({ children: [child] });
        placed = true;
      } else {
        finalUnassigned.push(child);
      }
    }
  }

  // 6. 便の「時間順ソート」と連番正規化 ★ここで逆転バグを修正★
  const finalColumns = sortedCols.map(col => {
    // 児童が0名の便を除外
    const validTrips = col.trips.filter((t: any) => t.children && t.children.length > 0);

    // 同じ車の中で、一番早い時間の児童が乗っている便を先頭（1便目）にする
    validTrips.sort((tripA: any, tripB: any) => {
      const timeA = Math.min(...tripA.children.map((c: any) => parseTime(c.time)));
      const timeB = Math.min(...tripB.children.map((c: any) => parseTime(c.time)));
      return timeA - timeB;
    });

    // 並び替えた後、1便目・2便目と名前を確定させる
    validTrips.forEach((t: any, idx: number) => {
      t.tripIndex = idx + 1;
      t.id = `${col.shiftId || col.id}-trip-${idx + 1}`;
    });

    // 完全に空車の車は、見た目のために空の1便目を作っておく
    if (validTrips.length === 0) {
      validTrips.push({
        id: `${col.shiftId || col.id}-trip-1`,
        tripIndex: 1,
        children: []
      });
    }

    return { ...col, trips: validTrips };
  });

  return { columns: finalColumns as VehicleColumn[], unassigned: finalUnassigned as ChildMagnet[] };
}
