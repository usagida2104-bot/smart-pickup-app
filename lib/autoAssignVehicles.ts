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

  // 1. 車両の初期化とソート（定員の大きい順: ステップワゴン/VOXY最優先）
  const sortedCols = [...columns]
    .map(col => ({ ...col, trips: [] })) // 一旦全便をクリーンアップ
    .sort((a, b) => (b.capacity || 0) - (a.capacity || 0));

  // 2. 児童を「学校×時間」でグループ化
  const groupsMap: Record<string, any[]> = {};
  for (const magnet of allMagnets) {
    const key = `${magnet.schoolName || '不明'}::${magnet.time || '-'}`;
    if (!groupsMap[key]) groupsMap[key] = [];
    groupsMap[key].push(magnet);
  }

  // 3. グループのソート（①人数が多い順 ➔ ②時間が早い順）
  // これにより、あぶくま支援学校（10人等）が必ず最初に処理されます
  const groups = Object.values(groupsMap).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const timeA = a[0].time || '99:99';
    const timeB = b[0].time || '99:99';
    return timeA.localeCompare(timeB);
  });

  let unassigned: any[] = [];

  // 4. グループごとに車両へ一括アサイン（Bin Packing）
  for (const group of groups) {
    let remaining = [...group];

    while (remaining.length > 0) {
      let placed = false;

      // パターンA: 既存の便で「同じ学校・時間」かつ「定員に空きがある」ものを探す（合流）
      for (const col of sortedCols) {
        if (col.trips.length === 0) continue;
        const lastTrip = col.trips[col.trips.length - 1];
        if (lastTrip.children.length > 0 && lastTrip.children.length < col.capacity) {
          const firstChild = lastTrip.children[0];
          if (firstChild.schoolName === remaining[0].schoolName && firstChild.time === remaining[0].time) {
            const space = col.capacity - lastTrip.children.length;
            const chunk = remaining.splice(0, space);
            lastTrip.children.push(...chunk);
            placed = true;
            break;
          }
        }
      }
      if (placed) continue;

      // パターンB: まだ空いている車両（便数が少ない＆定員が大きい）に新しい便を作成して詰め込む
      let bestCol = null;
      let minTrips = 999;
      for (const col of sortedCols) {
        if (col.trips.length < minTrips) {
          minTrips = col.trips.length;
          bestCol = col;
        }
      }

      if (bestCol && bestCol.trips.length < 4) { // 最大4便まで
        const chunk = remaining.splice(0, bestCol.capacity);
        bestCol.trips.push({
          id: `${bestCol.shiftId || bestCol.id}-trip-${bestCol.trips.length + 1}`,
          tripIndex: bestCol.trips.length + 1,
          children: chunk
        });
        placed = true;
      } else {
        // 全車フル稼働で乗せられない場合は一旦未割り当て配列へ逃がす
        unassigned.push(...remaining);
        remaining = [];
      }
    }
  }

  // 5. スイーパー処理（未割り当てを0にするための強制アサイン）
  const finalUnassigned: any[] = [];
  for (const child of unassigned) {
    let placed = false;
    // まず空き枠がある便にねじ込む
    for (const col of sortedCols) {
      if (col.trips.length === 0) continue;
      const lastTrip = col.trips[col.trips.length - 1];
      if (lastTrip.children.length < col.capacity) {
        lastTrip.children.push(child);
        placed = true;
        break;
      }
    }
    // それでもダメなら空きのある車に新しい便を作る
    if (!placed) {
      const bestCol = sortedCols.find(c => c.trips.length < 4);
      if (bestCol) {
        bestCol.trips.push({
          id: `${bestCol.shiftId || bestCol.id}-trip-${bestCol.trips.length + 1}`,
          tripIndex: bestCol.trips.length + 1,
          children: [child]
        });
        placed = true;
      }
    }
    // 完全に限界の場合は最終未割り当てへ
    if (!placed) {
      finalUnassigned.push(child);
    }
  }

  // 6. 仕上げ（便番号の正規化と、完全空車のダミー1便目作成）
  const finalColumns = sortedCols.map(col => {
    // 児童が0名の便を排除し、tripIndex を 1, 2, 3... と連番で振り直す
    const validTrips = col.trips.filter((t: any) => t.children && t.children.length > 0);
    validTrips.forEach((t: any, idx: number) => {
      t.tripIndex = idx + 1;
      t.id = `${col.shiftId || col.id}-trip-${idx + 1}`;
    });

    // 1便も走らない車は、UI表示用に空の1便目をセット（リセット状態の担保）
    if (validTrips.length === 0) {
      validTrips.push({
        id: `${col.shiftId || col.id}-trip-1`,
        tripIndex: 1,
        children: []
      });
    }

    return { ...col, trips: validTrips };
  });

  console.log(`【完全上書き版 自動配車】総出席: ${allMagnets.length}名 / 最終未割り当て: ${finalUnassigned.length}名`);

  return { columns: finalColumns as VehicleColumn[], unassigned: finalUnassigned as ChildMagnet[] };
}
