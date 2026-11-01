import { describe, it, expect } from "vitest";
import { useBoardStore } from "../lib/store/boardStore";
import { BoardState, ChildMagnet, VehicleColumn } from "../types";

describe("Staff-centric Board & Per-trip Vehicle Selection tests", () => {
  const mockChild1: ChildMagnet = {
    id: "child-1",
    childId: "child-1",
    name: "山田 太郎",
    color: "#3B82F6",
    has_caution: false,
    pickup_time: "14:30",
    school_name: "あぶくま支援学校",
    school_area: "中町",
    unit_name: "ぽっけ",
    notes: null,
    transportMode: "both",
  };

  const mockChild2: ChildMagnet = {
    id: "child-2",
    childId: "child-2",
    name: "佐藤 次郎",
    color: "#10B981",
    has_caution: false,
    pickup_time: "15:00",
    school_name: "中央小学校",
    school_area: "本町",
    unit_name: "ぽっけⅡ",
    notes: null,
    transportMode: "both",
  };

  it("allows setting different vehicles for each trip within a staff column and updates capacity", () => {
    // 内山スタッフのカラム（1便目: ステップワゴン(定員6), 2便目: ムーブ(定員2)）
    const initialColumns: VehicleColumn[] = [
      {
        id: "staff-s1",
        shiftId: "staff-s1",
        staffId: "s1",
        staffName: "内山",
        driverId: "s1",
        driverName: "内山",
        driverStatus: "present",
        capacity: 6,
        trips: [
          {
            id: "staff-s1-trip-1",
            tripIndex: 1,
            vehicleId: "v-stepwgn",
            vehicleName: "ステップワゴン",
            capacity: 6,
            children: [mockChild1],
          },
          {
            id: "staff-s1-trip-2",
            tripIndex: 2,
            vehicleId: "v-move",
            vehicleName: "ムーブ",
            capacity: 2,
            children: [],
          },
        ],
      },
    ];

    const initialBoard: BoardState = {
      columns: initialColumns,
      unassigned: { id: "unassigned", children: [mockChild2] },
      familyPickup: { id: "family-pickup", children: [] },
    };

    useBoardStore.getState().setBoard("inbound", initialBoard);

    const store = useBoardStore.getState();
    const col = store.inboundBoard.columns[0];
    expect(col.staffName).toBe("内山");
    expect(col.trips[0].vehicleName).toBe("ステップワゴン");
    expect(col.trips[0].capacity).toBe(6);
    expect(col.trips[1].vehicleName).toBe("ムーブ");
    expect(col.trips[1].capacity).toBe(2);

    // 2便目の車両を「シエンタ (定員4)」に変更
    useBoardStore.getState().updateTripVehicle(
      "inbound",
      "staff-s1",
      "staff-s1-trip-2",
      "v-sienta",
      "シエンタ",
      4
    );

    const updatedCol = useBoardStore.getState().inboundBoard.columns[0];
    expect(updatedCol.trips[1].vehicleId).toBe("v-sienta");
    expect(updatedCol.trips[1].vehicleName).toBe("シエンタ");
    expect(updatedCol.trips[1].capacity).toBe(4);
  });

  it("checks over-capacity accurately using each trip's individual vehicle capacity", () => {
    // 2便目（ムーブ、定員2名）に児童2名乗車で満員、3名乗車で超過判定
    const col = useBoardStore.getState().inboundBoard.columns[0];
    const trip2Id = col.trips[1].id;

    // 車両をムーブ(定員2)に設定
    useBoardStore.getState().updateTripVehicle(
      "inbound",
      "staff-s1",
      trip2Id,
      "v-move",
      "ムーブ",
      2
    );

    // 未割り当てから佐藤次郎を2便目へ移動
    useBoardStore.getState().moveChild("inbound", "child-2", "unassigned", trip2Id);

    expect(useBoardStore.getState().isOverCapacity("inbound", trip2Id)).toBe(false);

    // もう1名（山田太郎）も2便目へ移動させて合計2名（定員2名ピッタリ）
    useBoardStore.getState().moveChild("inbound", "child-1", "staff-s1-trip-1", trip2Id);
    expect(useBoardStore.getState().isOverCapacity("inbound", trip2Id)).toBe(false);

    // 仮想の3人目を直接注入して定員超過を検証
    const extraChild: ChildMagnet = { ...mockChild1, id: "child-3", childId: "child-3", name: "鈴木 三郎" };
    const curBoard = useBoardStore.getState().inboundBoard;
    const modifiedCols = curBoard.columns.map(c => ({
      ...c,
      trips: c.trips.map(t => t.id === trip2Id ? { ...t, children: [...t.children, extraChild] } : t),
    }));
    useBoardStore.getState().setBoard("inbound", { ...curBoard, columns: modifiedCols });

    // 3名 > 定員2名 で overCapacity === true
    expect(useBoardStore.getState().isOverCapacity("inbound", trip2Id)).toBe(true);
  });
});
