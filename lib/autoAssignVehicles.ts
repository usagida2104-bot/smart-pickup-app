import { AssignInput, AssignResult, VehicleColumn, ChildMagnet } from "@/types";

export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  // 1. 出席児童を抽出（欠席以外）
  const presentAttendances = attendances.filter(a => {
    if (!a.child) return false;
    const attStatus = (a as any).attendance_status || "present";
    return attStatus !== "absent" && a.status !== "absent";
  });
  
  const allMagnets: any[] = presentAttendances.map(a => {
    const child = a.child!;
    // 下校時間（pickup_time / departure_time）の厳格判定:
    // 未指定（null / 空文字 / '-'）の児童はデフォルト値で勝手に補完せず、配車対象外（未割り当てキープ）とする
    const timeVal = a.pickup_time || (a as any).departure_time;
    const hasValidTime = Boolean(
      timeVal && 
      typeof timeVal === "string" && 
      timeVal.trim() !== "" && 
      timeVal.trim() !== "-"
    );
    const time = hasValidTime ? timeVal.trim() : null;
            
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

  // 自動配車対象外（送迎なし、または下校時間未記入）の児童を未割り当てプールに安全退避
  const unassignableMagnets: any[] = [];
  const assignableMagnets: any[] = [];

  for (const m of allMagnets) {
    if (m.transportMode === "no_transport" || !m.time) {
      unassignableMagnets.push(m);
    } else {
      assignableMagnets.push(m);
    }
  }

  const columns: any[] = [...shifts].map((shift) => ({
      id: shift.id,
      shiftId: shift.id,
      vehicleId: shift.vehicle_id,
      vehicleName: shift.vehicle?.name ?? "不明な車両",
      driverId: shift.driver_id,
      driverName: shift.driver?.name ?? "不明なドライバー",
      driverStatus: (shift as any).driverStatus,
      driverStatusTime: (shift as any).driverStatusTime,
      capacity: shift.vehicle?.capacity ?? 0,
      trips: [], 
  }));

  // ============================================
  // あぶくま支援学校最優先 ＋ 同一時間グルーピング ＋ 動的・遅刻出勤制約
  // ============================================

  const cols = [...columns].map(col => ({ ...col, trips: [] as any[] }));

  const parseTime = (t: string | null | undefined) => {
    if (!t || typeof t !== "string" || t === "-" || t.trim() === "") return 9999;
    const parts = t.split(":");
    if (parts.length < 2) return 9999;
    const [h, m] = parts.map(Number);
    return ((h || 0) * 60) + ((m || 0));
  };

  // あぶくま支援学校の判定ヘルパー
  const isAbukuma = (schoolName: string) => {
    return (schoolName || '').includes('あぶくま');
  };

  // 学校名の正規化（あぶくま支援学校は統一）
  const normalizeSchool = (schoolName: string) => {
    if (isAbukuma(schoolName)) return 'あぶくま支援学校';
    return schoolName || '不明';
  };

  // ★動的・遅刻ドライバーの稼働判定ヘルパー★
  const canDriverTake = (col: any, schoolName: string, timeMinutes: number) => {
    // 遅刻（遅番）の場合
    if (col.driverStatus === 'late') {
      const arrivalTime = parseTime(col.driverStatusTime || '13:45');
      if (isAbukuma(schoolName)) {
        if (timeMinutes < arrivalTime + 25) return false;
      } else {
        if (timeMinutes < arrivalTime + 15) return false;
      }
    }
    
    // 早退の場合
    if (col.driverStatus === 'early_leave') {
      const leaveTime = parseTime(col.driverStatusTime || '15:00');
      if (timeMinutes > leaveTime - 30) return false;
    }

    return true;
  };

  // 車両が指定時刻に新規便を運行可能か判定（既存の便と最低25分のインターバルが必要）
  const canVehicleTakeAtTime = (col: any, targetTime: number) => {
    for (const trip of col.trips) {
      if (!trip.children || trip.children.length === 0) continue;
      const tripTimes = trip.children.map((c: any) => parseTime(c.time));
      const tripAvgTime = tripTimes.reduce((sum: number, t: number) => sum + t, 0) / tripTimes.length;
      // 時間間隔が25分未満の別便は運行が物理的に困難
      if (Math.abs(tripAvgTime - targetTime) < 25) {
        return false;
      }
    }
    return true;
  };

  // 1. 児童の優先グルーピング（正規化学校名 × 下校時間）
  const groupsMap: Record<string, any[]> = {};
  for (const m of assignableMagnets) {
    const normSchool = normalizeSchool(m.schoolName);
    const key = `${normSchool}::${m.time || '-'}`;
    if (!groupsMap[key]) groupsMap[key] = [];
    groupsMap[key].push(m);
  }

  // 2. グループのソート
  // 【最優先】あぶくま支援学校のグループ
  // その中で時間順（早い順） → 人数多い順
  // その他の学校: 時間順 → 人数多い順
  const groups = Object.values(groupsMap).sort((a, b) => {
    const isAbukumaA = isAbukuma(a[0].schoolName);
    const isAbukumaB = isAbukuma(b[0].schoolName);

    if (isAbukumaA && !isAbukumaB) return -1;
    if (!isAbukumaA && isAbukumaB) return 1;

    const timeA = parseTime(a[0].time);
    const timeB = parseTime(b[0].time);
    if (timeA !== timeB) return timeA - timeB;

    return b.length - a.length;
  });

  let unassigned: any[] = [];

  // 3. グループごとの配車処理
  for (const group of groups) {
    let remaining = [...group];
    const gTime = parseTime(remaining[0].time);
    const gSchool = normalizeSchool(remaining[0].schoolName);
    const isAbukumaGroup = isAbukuma(gSchool);

    while (remaining.length > 0) {
      let placed = false;

      // パターンA: 既存便への合流（同一学校 かつ 時間差が15分以内）
      for (const col of cols) {
        if (!canDriverTake(col, remaining[0].schoolName, gTime)) continue;

        for (const trip of col.trips) {
          if (!trip.children || trip.children.length === 0) continue;
          if (trip.children.length >= col.capacity) continue;
          
          const firstChild = trip.children[0];
          const tripTime = parseTime(firstChild.time);
          const firstSchool = normalizeSchool(firstChild.schoolName);
          
          // 同一学校で時間が近い便に合流
          if (firstSchool === gSchool && Math.abs(tripTime - gTime) <= 15) {
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

      // パターンB: 新規便の作成
      // 車両候補の選定
      const eligibleCols = cols.filter(col => {
        if (col.trips.length >= 4) return false;
        if (!canDriverTake(col, remaining[0].schoolName, gTime)) return false;
        if (!canVehicleTakeAtTime(col, gTime)) return false;
        return true;
      });

      if (eligibleCols.length > 0) {
        // ソート順の決定:
        // あぶくまグループの場合:
        // 1. グループ全員（remaining.length）が収まる車両（col.capacity >= remaining.length）を最優先
        // 2. その中で定員の大きい車両（ステップワゴン定員6、アイシス定員5など）を優先
        // 3. 便数が少ない車両（負荷分散）
        // その他の学校の場合:
        // 1. 便数が少ない車両
        // 2. 定員適合
        eligibleCols.sort((a, b) => {
          if (isAbukumaGroup) {
            const aFitsAll = a.capacity >= remaining.length ? 1 : 0;
            const bFitsAll = b.capacity >= remaining.length ? 1 : 0;
            if (aFitsAll !== bFitsAll) return bFitsAll - aFitsAll;

            // 定員の大きい車両を優先
            if (a.capacity !== b.capacity) return b.capacity - a.capacity;

            // 便数が少ない順
            if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;
          } else {
            // 便数が少ない順
            if (a.trips.length !== b.trips.length) return a.trips.length - b.trips.length;

            const aFitsAll = a.capacity >= remaining.length ? 1 : 0;
            const bFitsAll = b.capacity >= remaining.length ? 1 : 0;
            if (aFitsAll !== bFitsAll) return bFitsAll - aFitsAll;

            if (a.capacity !== b.capacity) return b.capacity - a.capacity;
          }
          return 0;
        });

        const bestCol = eligibleCols[0];
        const countToTake = Math.min(remaining.length, bestCol.capacity);
        const chunk = remaining.splice(0, countToTake);
        bestCol.trips.push({ children: chunk });
        placed = true;
      } else {
        // どの車両も時間または便数制限で取れない場合は未割り当てリストへ退避
        unassigned.push(...remaining);
        remaining = [];
      }
    }
  }

  // 4. スイーパー処理（未割り当ての回収）
  const finalUnassigned: any[] = [];
  for (const child of unassigned) {
    let placed = false;
    const childTime = parseTime(child.time);
    
    // ① 時間が近い（20分以内）既存便の空き枠にねじ込む
    for (const col of cols) {
      if (!canDriverTake(col, child.schoolName, childTime)) continue;
      for (const trip of col.trips) {
        if (trip.children.length < col.capacity) {
          const tripTimes = trip.children.map((c: any) => parseTime(c.time));
          const tripAvgTime = tripTimes.reduce((sum: number, t: number) => sum + t, 0) / tripTimes.length;
          if (Math.abs(tripAvgTime - childTime) <= 20) {
            trip.children.push(child);
            placed = true;
            break;
          }
        }
      }
      if (placed) break;
    }
    
    // ② 空きのある車両に新規便を作る
    if (!placed) {
      const candidates = cols
        .filter(col => col.trips.length < 4 && canDriverTake(col, child.schoolName, childTime) && canVehicleTakeAtTime(col, childTime))
        .sort((a, b) => a.trips.length - b.trips.length);

      if (candidates.length > 0) {
        candidates[0].trips.push({ children: [child] });
        placed = true;
      }
    }
    
    // ③ それでもどうしても配置できない場合は最終未割り当てへ
    if (!placed) {
      finalUnassigned.push(child);
    }
  }

  // 自動配車対象外（送迎なし、下校時間未記入）の児童を未割り当てリストに合流
  finalUnassigned.push(...unassignableMagnets);

  // 5. 便の「時間順ソート」と連番正規化
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

  console.log(`【あぶくま最優先・最適化版 自動配車】総出席: ${allMagnets.length}名 / 最終未割り当て: ${finalUnassigned.length}名`);

  return { columns: finalColumns as VehicleColumn[], unassigned: finalUnassigned as ChildMagnet[] };
}
