import {
  AssignInput,
  AssignResult,
  ChildMagnet,
  VehicleColumn,
} from "@/types";

/**
 * 自動配車ロジック
 *
 * アルゴリズム:
 * 1. 出席（status === 'present'）の児童のみ対象
 * 2. pickup_timeでソート（早い順）
 * 3. 稼働車両をcapacity降順でソート
 * 4. 貪欲法: 同一学校・同一時間帯の児童を同じ車両に優先配置
 * 5. キャパシティを超えた場合は次の車両へ
 * 6. 全車両が満員の場合は未割り当てプールへ
 */
export function autoAssignVehicles(input: AssignInput): AssignResult {
  const { attendances, shifts } = input;

  // 出席者のみ抽出（すでにフロントエンド側で必要な区分のみ絞り込まれて渡される想定）
  const presentAttendances = attendances.filter(
    (a) => a.child
  );

  // pickup_time でソート（nullは最後）
  const sorted = [...presentAttendances].sort((a, b) => {
    if (!a.pickup_time && !b.pickup_time) return 0;
    if (!a.pickup_time) return 1;
    if (!b.pickup_time) return -1;
    return a.pickup_time.localeCompare(b.pickup_time);
  });

  // 車両カラムを初期化（capacity降順）
  const columns: VehicleColumn[] = [...shifts]
    .sort((a, b) => (b.vehicle?.capacity ?? 0) - (a.vehicle?.capacity ?? 0))
    .map((shift) => ({
      id: shift.id,
      shiftId: shift.id,
      vehicleId: shift.vehicle_id,
      vehicleName: shift.vehicle?.name ?? "不明な車両",
      driverName: shift.driver?.name ?? "不明なドライバー",
      capacity: shift.vehicle?.capacity ?? 0,
      children: [],
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
      pickup_time: attendance.pickup_time,
      school_name: child.school?.name ?? "",
      school_area: child.school?.area ?? null,
      unit_name: child.unit_name,
      notes: child.notes,
    };

    // 同一学校・同一pickup_timeが既にいる車両を優先探索
    let assigned = false;

    // Pass 1: 同一エリア・同一時間が既にいて、まだ空きがある車両
    // 平準化のため、該当する車両が複数ある場合は現在の乗車人数が少ない順にソート（同数の場合はキャパシティの大きい順）
    const candidatePass1 = columns
      .filter((col) => col.children.length < col.capacity && col.children.some(c => 
        (
          (c.school_area && magnet.school_area && c.school_area === magnet.school_area) || 
          (!c.school_area && !magnet.school_area && c.school_name === magnet.school_name)
        ) && 
        c.pickup_time === magnet.pickup_time
      ))
      .sort((a, b) => {
        if (a.children.length !== b.children.length) return a.children.length - b.children.length;
        return b.capacity - a.capacity;
      });

    if (candidatePass1.length > 0) {
      candidatePass1[0].children.push(magnet);
      assigned = true;
    }

    // Pass 2: 空きがある車両のうち、現在乗車人数が一番少ない車両（平準化）
    if (!assigned) {
      const candidatePass2 = columns
        .filter((col) => col.children.length < col.capacity)
        .sort((a, b) => {
          if (a.children.length !== b.children.length) return a.children.length - b.children.length;
          return b.capacity - a.capacity;
        });

      if (candidatePass2.length > 0) {
        candidatePass2[0].children.push(magnet);
        assigned = true;
      }
    }

    // どこにも入れない場合は未割り当て
    if (!assigned) {
      unassigned.push(magnet);
    }
  }

  return { columns, unassigned };
}
