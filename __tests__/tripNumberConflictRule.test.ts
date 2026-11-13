import { describe, it, expect } from "vitest";
import {
  getInboundConflictingVehicles,
  getOutboundConflictingVehicles,
  assignVehiclesWithoutOverlap,
} from "../lib/vehicleUtils";

describe("Trip-number / Time-slot based Vehicle Conflict Rules", () => {
  describe("Inbound Mode (getInboundConflictingVehicles)", () => {
    const columns = [
      {
        id: "staff-muro",
        staffName: "室",
        trips: [
          {
            id: "staff-muro-trip-1",
            tripIndex: 1,
            vehicleId: "v-move",
            vehicleName: "ムーブ",
            children: [{ id: "c1", pickup_time: "14:30" }],
          },
          {
            id: "staff-muro-trip-2",
            tripIndex: 2,
            vehicleId: null,
            vehicleName: null,
            children: [],
          },
        ],
      },
      {
        id: "staff-suda",
        staffName: "須田",
        trips: [
          {
            id: "staff-suda-trip-1",
            tripIndex: 1,
            vehicleId: null,
            vehicleName: null,
            children: [], // 児童0人でも1便同士はチェック対象
          },
          {
            id: "staff-suda-trip-2",
            tripIndex: 2,
            vehicleId: null,
            vehicleName: null,
            children: [],
          },
        ],
      },
      {
        id: "staff-yanai",
        staffName: "矢内",
        trips: [
          {
            id: "staff-yanai-trip-1",
            tripIndex: 1,
            vehicleId: "v-every",
            vehicleName: "エブリィ",
            children: [{ id: "c2", pickup_time: "15:10" }],
          },
          {
            id: "staff-yanai-trip-2",
            tripIndex: 2,
            vehicleId: null,
            vehicleName: null,
            children: [],
          },
        ],
      },
    ];

    it("blocks selecting v-move on Trip 1 for Suda and Yanai when Muro uses it on Trip 1", () => {
      const sudaTrip1Conflicts = getInboundConflictingVehicles(
        columns,
        "staff-suda",
        "staff-suda-trip-1",
        1
      );
      expect(sudaTrip1Conflicts.map((c) => c.vehicleId)).toContain("v-move");
      expect(sudaTrip1Conflicts.map((c) => c.vehicleId)).toContain("v-every");

      const yanaiTrip1Conflicts = getInboundConflictingVehicles(
        columns,
        "staff-yanai",
        "staff-yanai-trip-1",
        1
      );
      expect(yanaiTrip1Conflicts.map((c) => c.vehicleId)).toContain("v-move");
      // 自便の車両は除外されること
      expect(yanaiTrip1Conflicts.map((c) => c.vehicleId)).not.toContain("v-every");
    });

    it("allows selecting v-move on Trip 2 for Muro, Suda, and Yanai even when Muro uses it on Trip 1", () => {
      const muroTrip2Conflicts = getInboundConflictingVehicles(
        columns,
        "staff-muro",
        "staff-muro-trip-2",
        2
      );
      expect(muroTrip2Conflicts).toHaveLength(0);

      const sudaTrip2Conflicts = getInboundConflictingVehicles(
        columns,
        "staff-suda",
        "staff-suda-trip-2",
        2
      );
      expect(sudaTrip2Conflicts).toHaveLength(0);

      const yanaiTrip2Conflicts = getInboundConflictingVehicles(
        columns,
        "staff-yanai",
        "staff-yanai-trip-2",
        2
      );
      expect(yanaiTrip2Conflicts).toHaveLength(0);
    });
  });

  describe("Outbound Mode (getOutboundConflictingVehicles)", () => {
    const columns = [
      {
        id: "staff-muro",
        staffName: "室",
        trips: [
          {
            id: "staff-muro-trip-1",
            tripIndex: 1,
            departure_time: "17:00",
            vehicleId: "v-move",
          },
        ],
      },
      {
        id: "staff-suda",
        staffName: "須田",
        trips: [
          {
            id: "staff-suda-trip-1",
            tripIndex: 1,
            departure_time: "17:00",
            vehicleId: null,
          },
          {
            id: "staff-suda-trip-2",
            tripIndex: 2,
            departure_time: "16:30",
            vehicleId: null,
          },
        ],
      },
    ];

    it("blocks duplicate vehicle in the same departure time slot (17:00) and allows across different time slots (16:30)", () => {
      const sameTimeConflicts = getOutboundConflictingVehicles(
        columns,
        "staff-suda",
        "staff-suda-trip-1",
        "17:00"
      );
      expect(sameTimeConflicts.map((c) => c.vehicleId)).toContain("v-move");

      const diffTimeConflicts = getOutboundConflictingVehicles(
        columns,
        "staff-suda",
        "staff-suda-trip-2",
        "16:30"
      );
      expect(diffTimeConflicts).toHaveLength(0);
    });
  });

  describe("Auto-assign alignment (assignVehiclesWithoutOverlap)", () => {
    it("prevents duplicate vehicles within the same tripIndex and allows reuse across different tripIndexes regardless of time overlap", () => {
      const columns = [
        {
          id: "staff-1",
          trips: [
            { tripIndex: 1, children: [{ pickup_time: "14:20" }] },
            { tripIndex: 2, children: [{ pickup_time: "14:30" }] },
          ],
        },
        {
          id: "staff-2",
          trips: [
            { tripIndex: 1, children: [{ pickup_time: "14:20" }] },
          ],
        },
      ];
      const vehicles = [
        { id: "v1", name: "アイシス", capacity: 6 },
        { id: "v2", name: "ムーブ", capacity: 2 },
      ];

      const result = assignVehiclesWithoutOverlap(columns, vehicles);
      const s1t1 = result[0].trips.find((t: any) => t.tripIndex === 1)?.vehicleId;
      const s1t2 = result[0].trips.find((t: any) => t.tripIndex === 2)?.vehicleId;
      const s2t1 = result[1].trips.find((t: any) => t.tripIndex === 1)?.vehicleId;

      // 1便同士は重複禁止
      expect(s1t1).not.toBe(s2t1);
      // 異なる便番号（1便と2便）間では同一車両の再利用が許可される
      expect(s1t2).toBe(s1t1);
    });
  });
});
