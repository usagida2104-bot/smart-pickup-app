import { describe, it, expect } from "vitest";
import { useBoardStore } from "../lib/store/boardStore";
import { ChildMagnet, VehicleColumn } from "../types";

const makeChild = (id: string, name: string): ChildMagnet => ({
  id,
  childId: id,
  name,
  color: "#3B82F6",
  has_caution: false,
  pickup_time: "14:30",
  school_name: "テスト小学校",
  school_area: "中央",
  unit_name: "ぽっけ",
  notes: null,
  transportMode: "both",
});

describe("swapStaffTrips (Staff-to-Staff Trip Swap)", () => {
  it("swaps all trips (vehicles, children, locations, times) while keeping staff metadata intact", () => {
    const childSuzuki = makeChild("c-suzuki", "鈴木 空");
    const childSato = makeChild("c-sato", "佐藤 蒼太");
    const childTanaka = makeChild("c-tanaka", "田中 花");

    const columns: VehicleColumn[] = [
      {
        id: "staff-muro",
        shiftId: "staff-muro",
        staffId: "muro",
        staffName: "室",
        driverId: "muro",
        driverName: "室",
        driverStatus: "present",
        staffRole: "ぽっけリーダー",
        vehicleId: "v-move",
        vehicleName: "ムーブ",
        capacity: 2,
        trips: [
          {
            id: "staff-muro-trip-1",
            tripIndex: 1,
            departure_time: "16:30",
            time: "16:30",
            vehicleId: "v-move",
            vehicleName: "ムーブ",
            capacity: 2,
            startLocation: "office",
            endLocation: "office",
            children: [childSuzuki],
          },
        ],
      },
      {
        id: "staff-suda",
        shiftId: "staff-suda",
        staffId: "suda",
        staffName: "須田",
        driverId: "suda",
        driverName: "須田",
        driverStatus: "late",
        driverStatusTime: "13:30",
        staffRole: "一般スタッフ",
        vehicleId: "v-every",
        vehicleName: "エブリィ",
        capacity: 4,
        trips: [
          {
            id: "staff-suda-trip-1",
            tripIndex: 1,
            departure_time: "16:30",
            time: "16:30",
            vehicleId: "v-every",
            vehicleName: "エブリィ",
            capacity: 4,
            startLocation: "office",
            endLocation: "office",
            children: [childSato],
          },
          {
            id: "staff-suda-trip-2",
            tripIndex: 2,
            departure_time: "17:30",
            time: "17:30",
            vehicleId: "v-sienta",
            vehicleName: "シエンタ",
            capacity: 4,
            startLocation: "office",
            endLocation: "home",
            children: [childTanaka],
          },
        ],
      },
    ];

    useBoardStore.getState().setBoard("outbound", {
      columns,
      unassigned: { id: "unassigned", children: [] },
      familyPickup: { id: "family-pickup", children: [] },
    });

    // 室と須田の担当便を入れ替え
    useBoardStore.getState().swapStaffTrips("outbound", "staff-muro", "staff-suda");

    const updated = useBoardStore.getState().outboundBoard;
    const muroCol = updated.columns[0];
    const sudaCol = updated.columns[1];

    // スタッフ固有情報・並び順は保持されること
    expect(muroCol.id).toBe("staff-muro");
    expect(muroCol.staffName).toBe("室");
    expect(muroCol.staffRole).toBe("ぽっけリーダー");
    expect(muroCol.driverStatus).toBe("present");

    expect(sudaCol.id).toBe("staff-suda");
    expect(sudaCol.staffName).toBe("須田");
    expect(sudaCol.driverStatus).toBe("late");
    expect(sudaCol.driverStatusTime).toBe("13:30");

    // 室側に須田の2便（エブリィ・シエンタ・佐藤蒼太・田中花）が移動していること
    expect(muroCol.trips).toHaveLength(2);
    expect(muroCol.trips[0].id).toBe("staff-muro-trip-1");
    expect(muroCol.trips[0].vehicleId).toBe("v-every");
    expect(muroCol.trips[0].vehicleName).toBe("エブリィ");
    expect(muroCol.trips[0].children.map((c) => c.id)).toEqual(["c-sato"]);
    expect(muroCol.trips[1].id).toBe("staff-muro-trip-2");
    expect(muroCol.trips[1].vehicleId).toBe("v-sienta");
    expect(muroCol.trips[1].endLocation).toBe("home");
    expect(muroCol.trips[1].children.map((c) => c.id)).toEqual(["c-tanaka"]);
    expect(muroCol.vehicleName).toBe("エブリィ");

    // 須田側に室の1便（ムーブ・鈴木空）が移動していること
    expect(sudaCol.trips).toHaveLength(1);
    expect(sudaCol.trips[0].id).toBe("staff-suda-trip-1");
    expect(sudaCol.trips[0].vehicleId).toBe("v-move");
    expect(sudaCol.trips[0].vehicleName).toBe("ムーブ");
    expect(sudaCol.trips[0].children.map((c) => c.id)).toEqual(["c-suzuki"]);
    expect(sudaCol.vehicleName).toBe("ムーブ");
  });

  it("allows subsequent drag/moveChild and updateTripVehicle without errors after swap", () => {
    const childA = makeChild("c-a", "児童A");
    const childB = makeChild("c-b", "児童B");

    useBoardStore.getState().setBoard("inbound", {
      columns: [
        {
          id: "staff-1",
          shiftId: "staff-1",
          staffId: "1",
          staffName: "室",
          trips: [
            {
              id: "staff-1-trip-1",
              tripIndex: 1,
              vehicleId: "v-1",
              vehicleName: "アイシス",
              capacity: 6,
              children: [childA],
            },
          ],
        },
        {
          id: "staff-2",
          shiftId: "staff-2",
          staffId: "2",
          staffName: "須田",
          trips: [
            {
              id: "staff-2-trip-1",
              tripIndex: 1,
              vehicleId: "v-2",
              vehicleName: "シエンタ",
              capacity: 4,
              children: [childB],
            },
          ],
        },
      ],
      unassigned: { id: "unassigned", children: [] },
      familyPickup: { id: "family-pickup", children: [] },
    });

    useBoardStore.getState().swapStaffTrips("inbound", "staff-1", "staff-2");

    // スワップ後の新しい便IDを使って児童を移動
    useBoardStore.getState().moveChild("inbound", "c-b", "staff-1-trip-1", "staff-2-trip-1");
    // スワップ後の車両変更
    useBoardStore.getState().updateTripVehicle("inbound", "staff-1", "staff-1-trip-1", "v-3", "ノート", 4);

    const board = useBoardStore.getState().inboundBoard;
    expect(board.columns[0].trips[0].children).toHaveLength(0);
    expect(board.columns[0].trips[0].vehicleName).toBe("ノート");
    expect(board.columns[1].trips[0].children.map((c) => c.id)).toEqual(["c-a", "c-b"]);
  });
});
