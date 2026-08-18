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
  // ラウンドロビン（負荷分散）と全車並行稼働アルゴリズム
  // ============================================

  // 1. 車両の初期化（ソートは後で動的に行う）
  const cols = [...columns].map(col => ({ ...col, trips: [] }));

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

  // 4. 配車・ラウンドロビンアサイン
  for (const group of groups) {
    let remaining = [...group];
    const gTime = parseTime(remaining[0].time);

    while (remaining.length > 0) {
      let placed = false;

      // パターンA: 同一学校の合流
      // 既に存在する便の中で、同じ学校かつ時間差30分以内で空きがあるものを探す
      // （※別学校の相乗りはここでは行わず、なるべく新しい便として別車両に回す）
      for (const col of cols) {
        for (const trip of col.trips) {
          if (trip.children.length === 0) continue;
          if (trip.children.length >= col.capacity) continue;
          
          const firstChild = trip.children[0];
          const tripTime = parseTime(firstChild.time);
          
          // 同一学校の場合は積極的に合流させる
          if (firstChild.schoolName === remaining[0].schoolName && Math.abs(tripTime - gTime) <= 30) {
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

      // パターンB: 新規便の作成（ラウンドロビン）
      // ①便数が少ない ➔ ②乗車人数が少ない ➔ ③定員が大きい 車両の順で探す
      const candidates = [...cols].sort((a, b) => {
         // ① まずは便数が少ない車（全員が1便目に出ることを保証）
         if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;
         
         // ② 次に合計乗車人数が少ない車（特定の人への過労を防ぐ）
         const totalA = a.trips.reduce((sum, t) => sum + t.children.length, 0);
         const totalB = b.trips.reduce((sum, t) => sum + t.children.length, 0);
         if (totalA !== totalB) return totalA - totalB;
         
         // ③ 同じ条件なら定員の大きい車を優先
         return (b.capacity || 0) - (a.capacity || 0);
      });

      const bestCol = candidates.find(col => col.trips.length < 4);
      if (bestCol) {
        const chunk = remaining.splice(0, bestCol.capacity);
        bestCol.trips.push({ children: chunk });
        placed = true;
      } else {
        // 全車フル稼働（各4便）で乗せられない場合は一旦未割り当て配列へ逃がす
        unassigned.push(...remaining);
        remaining = [];
      }
    }
  }

  // 5. スイーパー処理（未割り当ての強制回収）
  const finalUnassigned: any[] = [];
  for (const child of unassigned) {
    let placed = false;
    // まず空き枠がある便にねじ込む
    for (const col of cols) {
      for (const trip of col.trips) {
        if (trip.children.length < col.capacity) {
          trip.children.push(child);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    // それでもダメなら空きのある車に新しい便を作る
    if (!placed) {
      // ①便数が少ない ➔ ③定員が大きい 車両の順で探す
      const candidates = [...cols].sort((a, b) => {
         if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;
         return (b.capacity || 0) - (a.capacity || 0);
      });
      const bestCol = candidates.find(c => c.trips.length < 4);
      if (bestCol) {
        bestCol.trips.push({ children: [child] });
        placed = true;
      }
    }
    // 完全に限界の場合は最終未割り当てへ
    if (!placed) {
      finalUnassigned.push(child);
    }
  }

  // 6. 便の「時間順ソート」と連番正規化 ★ここで逆転バグを修正★
  const finalColumns = cols.map(col => {
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

  console.log(`【完全上書き版 自動配車(ラウンドロビン)】総出席: ${allMagnets.length}名 / 最終未割り当て: ${finalUnassigned.length}名`);

  return { columns: finalColumns as VehicleColumn[], unassigned: finalUnassigned as ChildMagnet[] };
}
