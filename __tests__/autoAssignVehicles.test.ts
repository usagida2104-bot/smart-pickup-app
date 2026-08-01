import { describe, it, expect } from "vitest";
import { autoAssignVehicles } from "../lib/autoAssignVehicles";
import { DailyAttendance, DailyShift } from "../types";

describe("autoAssignVehicles", () => {
  const createMockAttendance = (
    id: string,
    status: "present" | "absent" | "parent_pickup",
    pickup_time: string | null,
    school_name: string
  ): DailyAttendance => ({
    id,
    target_date: "2025-01-01",
    child_id: id,
    status,
    pickup_time,
    child: {
      id,
      name: `Child ${id}`,
      school_id: "s1",
      unit_name: null,
      has_caution: false,
      notes: null,
      school: {
        id: "s1",
        name: school_name,
        color_code: "#000",
      },
    },
  });

  const createMockShift = (id: string, capacity: number): DailyShift => ({
    id,
    target_date: "2025-01-01",
    vehicle_id: id,
    driver_id: "d1",
    vehicle: {
      id,
      name: `Vehicle ${id}`,
      capacity,
      vehicle_type: "minivan",
    },
    driver: {
      id: "d1",
      name: "Driver 1",
      is_driver: true,
    },
  });

  it("should assign present children and ignore absent ones", () => {
    const attendances = [
      createMockAttendance("1", "present", "15:00", "School A"),
      createMockAttendance("2", "absent", "15:00", "School A"),
    ];
    const shifts = [createMockShift("v1", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    expect(result.columns.length).toBe(1);
    expect(result.columns[0].children.length).toBe(1);
    expect(result.columns[0].children[0].id).toBe("1");
    expect(result.unassigned.length).toBe(0);
  });

  it("should handle over capacity by leaving children in unassigned", () => {
    const attendances = [
      createMockAttendance("1", "present", "15:00", "School A"),
      createMockAttendance("2", "present", "15:10", "School B"),
      createMockAttendance("3", "present", "15:20", "School C"),
    ];
    const shifts = [createMockShift("v1", 2)]; // Capacity is 2

    const result = autoAssignVehicles({ attendances, shifts });

    expect(result.columns[0].children.length).toBe(2);
    expect(result.unassigned.length).toBe(1);
    expect(result.unassigned[0].id).toBe("3"); // Last one due to pickup_time sorting
  });

  it("should return empty columns and empty unassigned when everyone is absent", () => {
    const attendances = [
      createMockAttendance("1", "absent", "15:00", "School A"),
      createMockAttendance("2", "parent_pickup", "15:00", "School B"),
    ];
    const shifts = [createMockShift("v1", 4), createMockShift("v2", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    expect(result.columns.length).toBe(2);
    expect(result.columns[0].children.length).toBe(0);
    expect(result.columns[1].children.length).toBe(0);
    expect(result.unassigned.length).toBe(0);
  });

  it("should assign sequentially filling vehicles up to capacity", () => {
    const attendances = [
      createMockAttendance("1", "present", "15:00", "School A"),
      createMockAttendance("2", "present", "15:00", "School B"),
      createMockAttendance("3", "present", "15:00", "School A"),
    ];
    const shifts = [
      createMockShift("v1", 2),
      createMockShift("v2", 2),
    ];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns.find((c) => c.id === "v1");
    const v2 = result.columns.find((c) => c.id === "v2");

    expect(v1?.children.length).toBe(2);
    expect(v1?.children.map(c => c.id)).toEqual(["1", "2"]);

    expect(v2?.children.length).toBe(1);
    expect(v2?.children.map(c => c.id)).toEqual(["3"]);
  });
});
