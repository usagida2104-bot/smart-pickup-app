import { describe, it, expect } from "vitest";
import { autoAssignVehicles } from "../lib/autoAssignVehicles";
import { DailyAttendance, DailyShift, TransportMode } from "../types";

describe("autoAssignVehicles", () => {
  const createMockAttendance = (
    id: string,
    status: TransportMode,
    pickup_time: string | null,
    school_name: string,
    area?: string
  ): DailyAttendance => ({
    id,
    target_date: "2025-01-01",
    child_id: id,
    status,
    pickup_time,
    attendance_status: "present",
    attendance_time: null,
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
        area: area || null,
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
      createMockAttendance("1", "both", "15:00", "School A"),
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
      createMockAttendance("1", "both", "15:00", "School A"),
      createMockAttendance("2", "both", "15:10", "School B"),
      createMockAttendance("3", "both", "15:20", "School C"),
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
      createMockAttendance("2", "no_transport", "15:00", "School B"),
    ];
    const shifts = [createMockShift("v1", 4), createMockShift("v2", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    expect(result.columns.length).toBe(2);
    expect(result.columns[0].children.length).toBe(0);
    expect(result.columns[1].children.length).toBe(0);
    expect(result.unassigned.length).toBe(0);
  });

  it("should distribute children evenly across vehicles (load balancing)", () => {
    const attendances = [
      createMockAttendance("1", "both", "15:00", "School A"),
      createMockAttendance("2", "both", "15:00", "School B"),
      createMockAttendance("3", "both", "15:00", "School A"),
      createMockAttendance("4", "both", "15:00", "School C"),
    ];
    const shifts = [
      createMockShift("v1", 4),
      createMockShift("v2", 4),
    ];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns.find((c) => c.id === "v1");
    const v2 = result.columns.find((c) => c.id === "v2");

    // Total 4 kids, 2 vehicles with equal capacity (4).
    // Due to load balancing, they should have 2 kids each.
    expect(v1?.children.length).toBe(2);
    expect(v2?.children.length).toBe(2);

    // School A (1 and 3) should be grouped together via Pass 1.
    const hasSchoolA = (col: any) => col.children.some((c: any) => c.id === "1") && col.children.some((c: any) => c.id === "3");
    
    expect(hasSchoolA(v1) || hasSchoolA(v2)).toBe(true);
  });

  it("should group children by area if different schools share the same area", () => {
    const attendances = [
      createMockAttendance("1", "both", "15:00", "School A", "North Area"),
      createMockAttendance("2", "both", "15:00", "School B", "South Area"),
      createMockAttendance("3", "both", "15:00", "School C", "North Area"),
      createMockAttendance("4", "both", "15:00", "School D", "South Area"),
    ];
    const shifts = [
      createMockShift("v1", 4),
      createMockShift("v2", 4),
    ];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns.find((c) => c.id === "v1");
    const v2 = result.columns.find((c) => c.id === "v2");

    // 1 & 3 should be together (North Area), 2 & 4 should be together (South Area)
    const hasNorthArea = (col: any) => col.children.some((c: any) => c.id === "1") && col.children.some((c: any) => c.id === "3");
    const hasSouthArea = (col: any) => col.children.some((c: any) => c.id === "2") && col.children.some((c: any) => c.id === "4");

    expect(
      (hasNorthArea(v1) && hasSouthArea(v2)) ||
      (hasNorthArea(v2) && hasSouthArea(v1))
    ).toBe(true);
  });
});
