import { describe, it, expect } from "vitest";
import { useBoardStore } from "../lib/store/boardStore";
import { VehicleColumn } from "../types";
import { assignVehiclesWithoutOverlap } from "../lib/vehicleUtils";

describe("Manual Vehicle Selection & Unassigned Default tests", () => {
  it("initializes addTrip with vehicleId null and undefined capacity (empty by default)", () => {
    const initialColumns: VehicleColumn[] = [
      {
        id: "staff-s1",
        shiftId: "staff-s1",
        staffId: "s1",
        staffName: "内山",
        driverId: "s1",
        driverName: "内山",
        driverStatus: "present",
        capacity: undefined,
        trips: [
          {
            id: "staff-s1-trip-1",
            tripIndex: 1,
            vehicleId: null,
            vehicleName: null,
            capacity: undefined,
            children: [],
          },
        ],
      },
    ];

    useBoardStore.getState().setBoard("inbound", {
      columns: initialColumns,
      unassigned: { id: "unassigned", children: [] },
      familyPickup: { id: "family-pickup", children: [] },
    });

    // 便を追加
    useBoardStore.getState().addTrip("inbound", "staff-s1");

    const board = useBoardStore.getState().inboundBoard;
    const col = board.columns.find((c) => c.id === "staff-s1");
    expect(col?.trips.length).toBe(2);

    const newTrip = col?.trips[1];
    expect(newTrip?.vehicleId).toBeNull();
    expect(newTrip?.vehicleName).toBeNull();
    expect(newTrip?.capacity).toBeUndefined();
  });

  it("updates trip vehicle manually and resets back to unselected", () => {
    const initialColumns: VehicleColumn[] = [
      {
        id: "staff-s1",
        shiftId: "staff-s1",
        staffId: "s1",
        staffName: "大平",
        driverId: "s1",
        driverName: "大平",
        driverStatus: "present",
        capacity: undefined,
        trips: [
          {
            id: "staff-s1-trip-1",
            tripIndex: 1,
            vehicleId: null,
            vehicleName: null,
            capacity: undefined,
            children: [],
          },
        ],
      },
    ];

    useBoardStore.getState().setBoard("outbound", {
      columns: initialColumns,
      unassigned: { id: "unassigned", children: [] },
      familyPickup: { id: "family-pickup", children: [] },
    });

    // 1. 車両を手動選択（例: アイシス）
    useBoardStore.getState().updateTripVehicle(
      "outbound",
      "staff-s1",
      "staff-s1-trip-1",
      "v-isis",
      "アイシス",
      6
    );

    let board = useBoardStore.getState().outboundBoard;
    let trip = board.columns[0].trips[0];
    expect(trip.vehicleId).toBe("v-isis");
    expect(trip.vehicleName).toBe("アイシス");
    expect(trip.capacity).toBe(6);

    // 2. 「車両を選択...」（未選択: 空文字）に戻す
    useBoardStore.getState().updateTripVehicle(
      "outbound",
      "staff-s1",
      "staff-s1-trip-1",
      "",
      "",
      0
    );

    board = useBoardStore.getState().outboundBoard;
    trip = board.columns[0].trips[0];
    expect(trip.vehicleId).toBeNull();
    expect(trip.vehicleName).toBeNull();
    expect(trip.capacity).toBeUndefined();
  });

  it("assigns available vehicles properly only when auto assign algorithm runs", () => {
    const unselectedColumns: VehicleColumn[] = [
      {
        id: "staff-1",
        shiftId: "staff-1",
        staffId: "s1",
        staffName: "スタッフ1",
        capacity: undefined,
        trips: [
          {
            id: "staff-1-trip-1",
            tripIndex: 1,
            vehicleId: null,
            vehicleName: null,
            capacity: undefined,
            children: [{ id: "c1", name: "児童1" } as any],
          },
        ],
      },
      {
        id: "staff-2",
        shiftId: "staff-2",
        staffId: "s2",
        staffName: "スタッフ2",
        capacity: undefined,
        trips: [
          {
            id: "staff-2-trip-1",
            tripIndex: 1,
            vehicleId: null,
            vehicleName: null,
            capacity: undefined,
            children: [{ id: "c2", name: "児童2" } as any],
          },
        ],
      },
    ];

    const availableVehicles = [
      { id: "v-step", name: "ステップワゴン", capacity: 6 },
      { id: "v-sienta", name: "シエンタ", capacity: 4 },
    ];

    // 自動配車アルゴリズム実行
    const assignedColumns = assignVehiclesWithoutOverlap(unselectedColumns, availableVehicles);

    // 両スタッフに重複のない車両が割り当てられること
    expect(assignedColumns[0].trips[0].vehicleId).toBeTruthy();
    expect(assignedColumns[1].trips[0].vehicleId).toBeTruthy();
    expect(assignedColumns[0].trips[0].vehicleId).not.toBe(assignedColumns[1].trips[0].vehicleId);
  });
});
