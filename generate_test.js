const fs = require('fs');

const testCode = `import { describe, it, expect } from "vitest";
import { autoAssignVehicles } from "../lib/autoAssignVehicles";
import { DailyAttendance, DailyShift, TransportMode } from "../types";

describe("autoAssignVehicles (Attribute-based Dynamic Mode)", () => {
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
      name: \`Child \${id}\`,
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
      name: \`Vehicle \${id} (Cap \${capacity})\`,
      capacity,
      vehicle_type: "minivan",
    },
    driver: {
      id: "d1",
      name: "Driver 1",
      is_driver: true,
    },
  });

  it("should assign trips strictly by time thresholds", () => {
    const attendances = [
      createMockAttendance("1", "both", "13:00", "School A"), // Trip 1 (<= 13:30)
      createMockAttendance("2", "both", "14:00", "School B"), // Trip 2 (13:35 ~ 14:15)
      createMockAttendance("3", "both", "14:30", "School C"), // Trip 3 (14:20 ~ 15:00)
      createMockAttendance("4", "both", "15:30", "School D"), // Trip 4 (>= 15:05)
    ];
    const shifts = [createMockShift("v1", 4)];

    const result = autoAssignVehicles({ attendances, shifts });
    const v1 = result.columns[0];
    
    expect(v1.trips.length).toBe(4);
    expect(v1.trips.find(t => t.tripIndex === 1)?.children[0].school_name).toBe("School A");
    expect(v1.trips.find(t => t.tripIndex === 2)?.children[0].school_name).toBe("School B");
    expect(v1.trips.find(t => t.tripIndex === 3)?.children[0].school_name).toBe("School C");
    expect(v1.trips.find(t => t.tripIndex === 4)?.children[0].school_name).toBe("School D");
  });

  it("should prohibit different schools in the same trip index of the same vehicle", () => {
    const attendances = [
      createMockAttendance("1", "both", "13:00", "School A"),
      createMockAttendance("2", "both", "13:00", "School B"), // Same time, different school
    ];
    // Only 1 vehicle with large capacity
    const shifts = [createMockShift("v1", 6)];

    const result = autoAssignVehicles({ attendances, shifts });
    const v1 = result.columns[0];

    // School A should be in trip 1. School B cannot share trip 1 of the same vehicle.
    // It should fallback to trip 2 of the same vehicle.
    expect(v1.trips.length).toBe(2);
    expect(v1.trips.find(t => t.tripIndex === 1)?.children[0].school_name).toBe("School A");
    expect(v1.trips.find(t => t.tripIndex === 2)?.children[0].school_name).toBe("School B");
  });

  it("should split large groups to other vehicles at the same time if capacity is exceeded", () => {
    // 6 children from School A at 13:00
    const attendances = Array.from({ length: 6 }).map((_, i) => 
      createMockAttendance(String(i + 1), "both", "13:00", "School A")
    );
    // 2 vehicles with capacity 4 each
    const shifts = [createMockShift("v1", 4), createMockShift("v2", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns.find(c => c.id === "v1");
    const v2 = result.columns.find(c => c.id === "v2");

    // Both should use trip 1 because they are available
    expect(v1?.trips.find(t => t.tripIndex === 1)?.children.length).toBe(4);
    expect(v2?.trips.find(t => t.tripIndex === 1)?.children.length).toBe(2);
    expect(result.unassigned.length).toBe(0);
  });

  it("should split large groups to the next trip of the same vehicle if no other vehicles are available", () => {
    // 6 children from School A at 13:00
    const attendances = Array.from({ length: 6 }).map((_, i) => 
      createMockAttendance(String(i + 1), "both", "13:00", "School A")
    );
    // ONLY 1 vehicle with capacity 4
    const shifts = [createMockShift("v1", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns[0];

    // Cannot fit 6 in trip 1. Should put 4 in trip 1, and 2 in trip 2.
    expect(v1.trips.find(t => t.tripIndex === 1)?.children.length).toBe(4);
    expect(v1.trips.find(t => t.tripIndex === 2)?.children.length).toBe(2);
    expect(result.unassigned.length).toBe(0);
  });
  
  it("should assign un-timed children to the largest group of the same school or 15:00 default", () => {
    const attendances = [
      createMockAttendance("1", "both", "13:00", "School A"), // Group 1 (13:00, Trip 1)
      createMockAttendance("2", "both", "13:00", "School A"), // Group 1 (13:00, Trip 1)
      createMockAttendance("3", "both", null, "School A"),    // Un-timed, should merge with Group 1
      createMockAttendance("4", "both", null, "School B"),    // Un-timed, no group, should default to 15:00 (Trip 3)
    ];
    const shifts = [createMockShift("v1", 6)];

    const result = autoAssignVehicles({ attendances, shifts });
    const v1 = result.columns[0];

    // School A should be Trip 1 with 3 children
    expect(v1.trips.find(t => t.tripIndex === 1)?.children.length).toBe(3);
    expect(v1.trips.find(t => t.tripIndex === 1)?.children[0].school_name).toBe("School A");

    // School B should be Trip 3 (15:00) with 1 child
    expect(v1.trips.find(t => t.tripIndex === 3)?.children.length).toBe(1);
    expect(v1.trips.find(t => t.tripIndex === 3)?.children[0].school_name).toBe("School B");
  });
});
`;

fs.writeFileSync('__tests__/autoAssignVehicles.test.ts', testCode);
console.log("Written autoAssignVehicles.test.ts");
