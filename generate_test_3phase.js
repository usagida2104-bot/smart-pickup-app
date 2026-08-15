const fs = require('fs');

const testCode = `import { describe, it, expect } from "vitest";
import { autoAssignVehicles } from "../lib/autoAssignVehicles";
import { DailyAttendance, DailyShift, TransportMode } from "../types";

describe("autoAssignVehicles (3-Phase Zero-Unassigned Mode)", () => {
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

  it("Phase 1: should assign trips strictly by time thresholds", () => {
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
    expect(result.unassigned.length).toBe(0);
  });

  it("Phase 2: should mix different schools in the same trip index if capacity allows", () => {
    const attendances = [
      createMockAttendance("1", "both", "13:00", "School A"),
      createMockAttendance("2", "both", "13:00", "School B"), // Same time, different school
    ];
    // Only 1 vehicle with large capacity
    const shifts = [createMockShift("v1", 6)];

    const result = autoAssignVehicles({ attendances, shifts });
    const v1 = result.columns[0];

    // In Phase 1, School B is unassigned because v1's trip 1 is occupied by School A.
    // In Phase 2, School B is assigned to v1's trip 1 because it's the same trip index and there's space.
    expect(v1.trips.length).toBe(1);
    expect(v1.trips.find(t => t.tripIndex === 1)?.children.length).toBe(2);
    expect(result.unassigned.length).toBe(0);
  });

  it("Phase 3: should assign to a different trip index if the ideal trip index is full", () => {
    const attendances = [
      createMockAttendance("1", "both", "13:00", "School A"),
      createMockAttendance("2", "both", "13:00", "School A"),
      createMockAttendance("3", "both", "13:00", "School B"),
    ];
    // 1 vehicle with capacity 2
    const shifts = [createMockShift("v1", 2)];

    const result = autoAssignVehicles({ attendances, shifts });
    const v1 = result.columns[0];

    // Trip 1 can only hold 2 children. So School A takes trip 1.
    // Phase 2 tries to put School B in trip 1, but it's full.
    // Phase 3 tries other trips. It will put School B in trip 2.
    expect(v1.trips.find(t => t.tripIndex === 1)?.children.length).toBe(2);
    expect(v1.trips.find(t => t.tripIndex === 2)?.children.length).toBe(1);
    expect(result.unassigned.length).toBe(0);
  });

  it("Phase 3: should split large groups to the next trip of the same vehicle if no other vehicles are available", () => {
    // 6 children from School A at 13:00
    const attendances = Array.from({ length: 6 }).map((_, i) => 
      createMockAttendance(String(i + 1), "both", "13:00", "School A")
    );
    // ONLY 1 vehicle with capacity 4
    const shifts = [createMockShift("v1", 4)];

    const result = autoAssignVehicles({ attendances, shifts });

    const v1 = result.columns[0];

    // Cannot fit 6 in trip 1. 4 in trip 1 (Phase 1), and 2 in trip 2 (Phase 3).
    expect(v1.trips.find(t => t.tripIndex === 1)?.children.length).toBe(4);
    expect(v1.trips.find(t => t.tripIndex === 2)?.children.length).toBe(2);
    expect(result.unassigned.length).toBe(0);
  });

  it("Constraints: should NOT mix NG children even in Phase 3", () => {
    const attendances = [
      createMockAttendance("1", "both", "13:00", "School A", null, "NG:Child 2"), // Child 1 hates Child 2
      createMockAttendance("2", "both", "13:00", "School A", null, null),         // Child 2
    ];
    // 1 vehicle with capacity 4
    const shifts = [createMockShift("v1", 4)];

    const result = autoAssignVehicles({ attendances, shifts });
    const v1 = result.columns[0];

    // Phase 1 separates them into different groups because of NG.
    // Group 1 takes trip 1.
    // Phase 2 tries to put Group 2 into trip 1, but NG constraint fails.
    // Phase 3 tries to put Group 2 into trip 1, but NG fails. 
    // Then Phase 3 tries trip 2, and succeeds!
    expect(v1.trips.find(t => t.tripIndex === 1)?.children.length).toBe(1);
    expect(v1.trips.find(t => t.tripIndex === 2)?.children.length).toBe(1);
    expect(result.unassigned.length).toBe(0);
  });
  
  it("Phase 3 fallback when physical capacity is fully exhausted", () => {
    // 10 children
    const attendances = Array.from({ length: 10 }).map((_, i) => 
      createMockAttendance(String(i + 1), "both", "13:00", "School A")
    );
    // 1 vehicle, capacity 2. 4 trips = 8 slots max.
    const shifts = [createMockShift("v1", 2)];

    const result = autoAssignVehicles({ attendances, shifts });

    // 8 children assigned, 2 unassigned.
    expect(result.unassigned.length).toBe(2);
    const assignedCount = result.columns[0].trips.reduce((acc, trip) => acc + trip.children.length, 0);
    expect(assignedCount).toBe(8);
  });
});
`;

fs.writeFileSync('__tests__/autoAssignVehicles.test.ts', testCode);
console.log("Written autoAssignVehicles.test.ts");
