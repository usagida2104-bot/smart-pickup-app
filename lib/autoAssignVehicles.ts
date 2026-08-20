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
  // ラウンドロビン（負荷分散）＋ 個別出勤制約
  // ============================================

  const cols = [...columns].map(col => ({ ...col, trips: [] }));

  const parseTime = (t: string) => {
    if (!t || t === '-') return 9999;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // ★高宮さんの稼働判定ヘルパー★
  const canTakamiyaTake = (schoolName: string, timeMinutes: number) => {
    if ((schoolName || '').includes('あぶくま')) {
      return timeMinutes >= 14 * 60 + 10; // 14:10以降
    }
    return timeMinutes >= 14 * 60; // その他は14:00以降
  };

  const groupsMap: Record<string, any[]> = {};
  for (const m of allMagnets) {
    const key = `${m.schoolName || '不明'}::${m.time || '-'}`;
    if (!groupsMap[key]) groupsMap[key] = [];
    groupsMap[key].push(m);
  }

  const groups = Object.values(groupsMap).sort((a, b) => {
    const timeA = parseTime(a[0].time);
    const timeB = parseTime(b[0].time);
    if (timeA !== timeB) return timeA - timeB;
    return b.length - a.length;
  });

  let unassigned: any[] = [];

  for (const group of groups) {
    let remaining = [...group];
    const gTime = parseTime(remaining[0].time);

    while (remaining.length > 0) {
      let placed = false;

      // パターンA: 同一学校の合流
      for (const col of cols) {
        // ★高宮さん制約チェック★
        if (col.driverName?.includes('高宮') && !canTakamiyaTake(remaining[0].schoolName, gTime)) {
           continue;
        }

        for (const trip of col.trips) {
          if (trip.children.length === 0) continue;
          if (trip.children.length >= col.capacity) continue;
          
          const firstChild = trip.children[0];
          const tripTime = parseTime(firstChild.time);
          
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
      const candidates = [...cols].sort((a, b) => {
         if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;
         const totalA = a.trips.reduce((sum, t) => sum + t.children.length, 0);
         const totalB = b.trips.reduce((sum, t) => sum + t.children.length, 0);
         if (totalA !== totalB) return totalA - totalB;
         return (b.capacity || 0) - (a.capacity || 0);
      });

      const bestCol = candidates.find(col => {
         if (col.trips.length >= 4) return false;
         // ★高宮さん制約チェック★
         if (col.driverName?.includes('高宮') && !canTakamiyaTake(remaining[0].schoolName, gTime)) {
            return false;
         }
         return true;
      });

      if (bestCol) {
        const chunk = remaining.splice(0, bestCol.capacity);
        bestCol.trips.push({ children: chunk });
        placed = true;
      } else {
        unassigned.push(...remaining);
        remaining = [];
      }
    }
  }

  // 5. スイーパー処理（未割り当ての強制回収）
  const finalUnassigned: any[] = [];
  for (const child of unassigned) {
    let placed = false;
    const childTime = parseTime(child.time);
    
    // まず空き枠がある便にねじ込む
    for (const col of cols) {
      if (col.driverName?.includes('高宮') && !canTakamiyaTake(child.schoolName, childTime)) {
         continue;
      }
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
      const candidates = [...cols].sort((a, b) => {
         if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;
         return (b.capacity || 0) - (a.capacity || 0);
      });
      const bestCol = candidates.find(col => {
         if (col.trips.length >= 4) return false;
         if (col.driverName?.includes('高宮') && !canTakamiyaTake(child.schoolName, childTime)) return false;
         return true;
      });
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

  // 6. 便の「時間順ソート」と連番正規化
  const finalColumns = cols.map(col => {
    const validTrips = col.trips.filter((t: any) => t.children && t.children.length > 0);

    validTrips.sort((tripA: any, tripB: any) => {
      const timeA = Math.min(...tripA.children.map((c: any) => parseTime(c.time)));
      const timeB = Math.min(...tripB.children.map((c: any) => parseTime(c.time)));
      return timeA - timeB;
    });

    validTrips.forEach((t: any, idx: number) => {
      t.tripIndex = idx + 1;
      t.id = `${col.shiftId || col.id}-trip-${idx + 1}`;
    });

    if (validTrips.length === 0) {
      validTrips.push({
        id: `${col.shiftId || col.id}-trip-1`,
        tripIndex: 1,
        children: []
      });
    }

    return { ...col, trips: validTrips };
  });

  console.log(`【高宮さん制約追加版 自動配車】総出席: ${allMagnets.length}名 / 最終未割り当て: ${finalUnassigned.length}名`);

  return { columns: finalColumns as VehicleColumn[], unassigned: finalUnassigned as ChildMagnet[] };
}
