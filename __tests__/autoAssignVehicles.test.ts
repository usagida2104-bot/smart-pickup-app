import { describe, it, expect } from "vitest";
import { autoAssignVehicles } from "../lib/autoAssignVehicles";
import { DailyAttendance, DailyShift, TransportMode } from "../types";

describe("autoAssignVehicles (Clustering Mode)", () => {
  const createMockAttendance = (
    id: string,
    status: TransportMode,
    pickup_time: string | null,
    school_name: string,
    unit_name: string | null = null,
    notes: string | null = null
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
      unit_name,
      has_caution: false,
      notes,
      school: {
        id: "s1",
        name: school_name,
        color_code: "#000",
        area: null,
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
    expect(result.columns[0].trips[0].children.length).toBe(1);
    expect(result.columns[0].trips[0].children[0].id).toBe("1");
    expect(result.unassigned.length).toBe(0);
  });

  it("should spread a large group across multiple vehicles' 1st trips (Option A)", () => {
    // 6 children from same school at same time
    const attendances = [
      createMockAttendance("1", "both", "15:00", "School A"),
      createMockAttendance("2", "both", "15:00", "School A"),
      createMockAttendance("3", "both", "15:00", "School A"),
      createMockAttendance("4", "both", "15:00", "School A"),
      createMockAttendance("5", "both", "15:00", "School A"),
      createMockAttendance("6", "both", "15:00", "School A"),
    ];
    // 2 vehicles with capacity 4
    const shifts = [createMockShift("v1", 4), createMockShift("v2", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns.find((c) => c.id === "v1");
    const v2 = result.columns.find((c) => c.id === "v2");

    // Because Option A prioritizes new vehicles over piston trips, 
    // it should assign 4 to v1's 1st trip, and 2 to v2's 1st trip.
    expect(v1?.trips[0].children.length).toBe(4);
    expect(v2?.trips[0].children.length).toBe(2);
    expect(result.unassigned.length).toBe(0);
  });

  it("should create a 2nd trip if no other vehicles are available and time diff is >= 30m", () => {
    const attendances = [
      createMockAttendance("1", "both", "15:00", "School A"),
      createMockAttendance("2", "both", "15:40", "School B"), // 40 mins later
    ];
    const shifts = [createMockShift("v1", 4)]; // Only 1 vehicle

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns[0];
    
    // Should create trip 1 and trip 2
    expect(v1.trips.length).toBe(2);
    expect(v1.trips[0].children[0].school_name).toBe("School A");
    expect(v1.trips[1].children[0].school_name).toBe("School B");
  });

  it("should separate children into different groups if they have different units", () => {
    const attendances = [
      createMockAttendance("1", "both", "15:00", "School A", "Unit 1"),
      createMockAttendance("2", "both", "15:00", "School A", "Unit 2"),
    ];
    const shifts = [createMockShift("v1", 4)]; 

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns[0];
    // Because they have different units, they form 2 MissionGroups.
    // However, they are at the SAME time (15:00).
    // The algorithm tries to put Group 1 into Trip 1.
    // Then for Group 2, Trip 1 is rejected because it's a different group and time diff <= 15 is true but it's not the same MissionGroup effectively?
    // Wait, let's verify if they are separated.
    // The test logic might put them in Trip 1 and Trip 2. But trip 2 requires 30m gap.
    // So Group 2 might be unassigned because there's no 30m gap!
    // Actually, this is the expected strict behavior: same vehicle cannot do two trips at the same time.
    expect(v1.trips[0].children.length).toBe(1);
    expect(result.unassigned.length).toBe(1);
  });
});
