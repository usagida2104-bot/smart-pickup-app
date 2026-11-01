import { describe, it, expect } from "vitest";
import {
  getVehicleColorTheme,
  getTripTimeSummary,
  getTripTimeRange,
  isTimeRangeOverlapping,
  getConflictingVehicleIds,
  assignVehiclesWithoutOverlap,
  isPickupRequired,
  isDropoffRequired,
  isTransportRequired,
} from "../lib/vehicleUtils";

describe("Vehicle Scheduling & Visual Enhancement Utilities", () => {
  describe("getVehicleColorTheme", () => {
    it("assigns distinct color themes to known vehicle models", () => {
      expect(getVehicleColorTheme("ボクシー").badgeBg).toContain("blue");
      expect(getVehicleColorTheme("ステップワゴン").badgeBg).toContain("emerald");
      expect(getVehicleColorTheme("シエンタ").badgeBg).toContain("orange");
      expect(getVehicleColorTheme("アイシス").badgeBg).toContain("cyan");
      expect(getVehicleColorTheme("ブーン").badgeBg).toContain("purple");
      expect(getVehicleColorTheme("ムーブ（軽）").badgeBg).toContain("purple");
      expect(getVehicleColorTheme("その他ワゴン").badgeBg).toContain("slate");
    });
  });

  describe("getTripTimeSummary", () => {
    it("returns formatted min and max time range string", () => {
      const children = [
        { pickup_time: "14:30" },
        { pickup_time: "14:10" },
        { pickup_time: "14:25" },
      ];
      expect(getTripTimeSummary(children)).toBe("14:10〜14:30");
    });

    it("handles single child trip", () => {
      const children = [{ pickup_time: "15:00" }];
      expect(getTripTimeSummary(children)).toBe("15:00〜15:00");
    });

    it("returns null when no valid times are present", () => {
      expect(getTripTimeSummary([])).toBeNull();
      expect(getTripTimeSummary([{ pickup_time: "-" }])).toBeNull();
    });
  });

  describe("isTimeRangeOverlapping", () => {
    it("accurately detects overlapping time ranges", () => {
      // 14:00 (840分) 〜 14:35 (875分) と 14:20 (860分) 〜 14:50 (890分)
      expect(isTimeRangeOverlapping([840, 875], [860, 890])).toBe(true);

      // 14:00 (840分) 〜 14:25 (865分) と 14:30 (870分) 〜 15:00 (900分)
      expect(isTimeRangeOverlapping([840, 865], [870, 900])).toBe(false);

      // 終了時刻と開始時刻が一致（連続運行）
      expect(isTimeRangeOverlapping([840, 865], [865, 890])).toBe(false);
    });
  });

  describe("getConflictingVehicleIds (Manual Validation)", () => {
    it("detects when another staff is using the vehicle in an overlapping time window", () => {
      const mockColumns = [
        {
          id: "col-staff-1",
          staffName: "内山",
          trips: [
            {
              id: "trip-1-1",
              tripIndex: 1,
              vehicleId: "v-stepwgn",
              children: [{ pickup_time: "14:10" }, { pickup_time: "14:25" }], // range: ~14:10 - 14:50
            },
          ],
        },
      ];

      // スタッフ2の1便（14:20〜14:40）がステップワゴンを選ぼうとした場合 -> 衝突検出
      const conflicts = getConflictingVehicleIds(
        mockColumns,
        "col-staff-2",
        "trip-2-1",
        [{ pickup_time: "14:20" }]
      );

      expect(conflicts.length).toBe(1);
      expect(conflicts[0].vehicleId).toBe("v-stepwgn");
      expect(conflicts[0].conflictStaffName).toBe("内山");
      expect(conflicts[0].conflictTripIndex).toBe(1);

      // スタッフ2の2便（15:10〜15:30）がステップワゴンを選ぼうとした場合 -> 衝突なし（14:50に終了済み）
      const conflictsLater = getConflictingVehicleIds(
        mockColumns,
        "col-staff-2",
        "trip-2-2",
        [{ pickup_time: "15:10" }]
      );
      expect(conflictsLater.length).toBe(0);
    });
  });

  describe("assignVehiclesWithoutOverlap (Auto-Assign No Overlap)", () => {
    it("guarantees 100% unique vehicles for trip 1 across all staff (no double booking on trip 1)", () => {
      const mockColumns = [
        {
          id: "staff-1",
          trips: [
            { tripIndex: 1, children: [{ pickup_time: "14:10" }, { pickup_time: "14:15" }] },
          ],
        },
        {
          id: "staff-2",
          trips: [
            { tripIndex: 1, children: [{ pickup_time: "14:10" }, { pickup_time: "14:20" }] },
          ],
        },
        {
          id: "staff-3",
          trips: [
            { tripIndex: 1, children: [{ pickup_time: "14:15" }] },
          ],
        },
      ];

      const availableVehicles = [
        { id: "v1", name: "ステップワゴン", capacity: 6 },
        { id: "v2", name: "ボクシー", capacity: 6 },
        { id: "v3", name: "シエンタ", capacity: 4 },
        { id: "v4", name: "ムーブ", capacity: 2 },
      ];

      const allocated = assignVehiclesWithoutOverlap(mockColumns, availableVehicles);

      // 1便目同士の車両IDを抽出
      const trip1VehicleIds = allocated.map(col => col.trips.find((t: any) => t.tripIndex === 1)?.vehicleId);

      // 全員異なる車両が割り当てられていること（重複なし）
      const uniqueIds = new Set(trip1VehicleIds);
      expect(uniqueIds.size).toBe(3);
    });

    it("allows reusing a vehicle in trip 2 only after trip 1 has finished", () => {
      const mockColumns = [
        {
          id: "staff-1",
          trips: [
            { tripIndex: 1, children: [{ pickup_time: "14:10" }, { pickup_time: "14:20" }] }, // 終了 ~14:45
            { tripIndex: 2, children: [{ pickup_time: "15:15" }, { pickup_time: "15:25" }] }, // 開始 15:15
          ],
        },
      ];

      const availableVehicles = [
        { id: "v1", name: "ステップワゴン", capacity: 6 },
      ];

      const allocated = assignVehiclesWithoutOverlap(mockColumns, availableVehicles);

      const staff1Trip1 = allocated[0].trips.find((t: any) => t.tripIndex === 1);
      const staff1Trip2 = allocated[0].trips.find((t: any) => t.tripIndex === 2);

      // 1便目が終わった後の時間帯なので同じ車を安全に再利用できる
      expect(staff1Trip1?.vehicleId).toBe("v1");
      expect(staff1Trip2?.vehicleId).toBe("v1");
    });
  });

  describe("Print Layout Filtering (Active Driving Staff & Non-empty Trips)", () => {
    it("filters out staff with zero assigned children from print output", () => {
      const mockColumns = [
        {
          id: "staff-1",
          staffName: "増子",
          trips: [
            { tripIndex: 1, children: [{ name: "児童A", pickup_time: "14:10" }] },
            { tripIndex: 2, children: [{ name: "児童B", pickup_time: "15:10" }] },
          ],
        },
        {
          id: "staff-2",
          staffName: "内山",
          trips: [
            { tripIndex: 1, children: [{ name: "児童C", pickup_time: "14:10" }] },
            { tripIndex: 2, children: [] }, // 2便目は空
          ],
        },
        {
          id: "staff-3",
          staffName: "室",
          trips: [
            { tripIndex: 1, children: [] },
            { tripIndex: 2, children: [] }, // 全便空（運転しない）
          ],
        },
        {
          id: "staff-4",
          staffName: "須田",
          trips: [
            { tripIndex: 1, children: [] }, // 全便空（運転しない）
          ],
        },
      ];

      // 印刷対象スタッフ（児童が1名以上いるスタッフのみ）
      const activeDrivingStaff = mockColumns.filter((col) =>
        (col.trips || []).some((trip) => (trip.children || []).length > 0)
      );

      expect(activeDrivingStaff.length).toBe(2);
      expect(activeDrivingStaff.map((s) => s.staffName)).toEqual(["増子", "内山"]);

      // スタッフごとの有効運行便
      const masukoTrips = (activeDrivingStaff[0].trips || []).filter((t) => t.children.length > 0);
      expect(masukoTrips.length).toBe(2); // 1便と2便の両方

      const uchiyamaTrips = (activeDrivingStaff[1].trips || []).filter((t) => t.children.length > 0);
      expect(uchiyamaTrips.length).toBe(1); // 1便のみ（2便目は非表示）
    });

    it("simultaneously prepares inbound and outbound boards for A4 portrait 2-tier print layout", () => {
      const mockInboundCols = [
        {
          id: "staff-1",
          staffName: "増子",
          trips: [
            { tripIndex: 1, vehicleName: "ステップワゴン", children: [{ name: "児童A", pickup_time: "14:10" }] },
            { tripIndex: 2, vehicleName: "ステップワゴン", children: [] },
          ],
        },
        {
          id: "staff-2",
          staffName: "内山",
          trips: [
            { tripIndex: 1, vehicleName: "ボクシー", children: [{ name: "児童B", pickup_time: "14:15" }] },
          ],
        },
        {
          id: "staff-3",
          staffName: "室",
          trips: [{ tripIndex: 1, children: [] }],
        },
      ];

      const mockOutboundCols = [
        {
          id: "staff-1",
          staffName: "増子",
          trips: [
            { tripIndex: 1, vehicleName: "ステップワゴン", children: [{ name: "児童A", pickup_time: "17:00" }] },
            { tripIndex: 2, vehicleName: "ステップワゴン", children: [{ name: "児童B", pickup_time: "17:40" }] },
          ],
        },
        {
          id: "staff-2",
          staffName: "内山",
          trips: [{ tripIndex: 1, vehicleName: "ボクシー", children: [] }],
        },
      ];

      const mockFamilyPickup = {
        children: [
          { id: "child-fp-1", name: "児童C", pickup_time: "16:30" },
        ],
      };

      // 迎え（上段）の運行スタッフ
      const activeInbound = mockInboundCols.filter(col =>
        (col.trips || []).some(t => (t.children || []).length > 0)
      );
      expect(activeInbound.length).toBe(2);
      expect(activeInbound.map(s => s.staffName)).toEqual(["増子", "内山"]);

      // 送り（下段）の運行スタッフ
      const activeOutbound = mockOutboundCols.filter(col =>
        (col.trips || []).some(t => (t.children || []).length > 0)
      );
      expect(activeOutbound.length).toBe(1);
      expect(activeOutbound[0].staffName).toBe("増子");
      expect(activeOutbound[0].trips.filter(t => t.children.length > 0).length).toBe(2);

      // 送りの家族迎え枠
      expect(mockFamilyPickup.children.length).toBe(1);
      expect(mockFamilyPickup.children[0].name).toBe("児童C");
    });

    it("correctly extracts and sorts no-transport/family-pickup children for left dedicated box", () => {
      const mockAttendances = [
        { child_id: "c-1", attendance_status: "present", status: "both", pickup_time: "14:10" },
        { child_id: "c-2", attendance_status: "present", status: "no_transport", pickup_time: "15:15" }, // 國分里穂等 (送迎不要)
        { child_id: "c-3", attendance_status: "present", status: "dropoff_only", pickup_time: "14:30" }, // 迎えは家族送迎
        { child_id: "c-4", attendance_status: "present", status: "pickup_only", pickup_time: "17:00" }, // 送りは家族送迎
        { child_id: "c-5", attendance_status: "absent", status: "no_transport", pickup_time: "15:00" }, // 欠席は除外
      ];

      const mockChildren = [
        { id: "c-1", name: "鈴木一郎" },
        { id: "c-2", name: "國分里穂" },
        { id: "c-3", name: "佐藤花子" },
        { id: "c-4", name: "田中太郎" },
        { id: "c-5", name: "欠席児童" },
      ];

      // 迎えで送迎車に乗っている児童
      const inboundAssignedIds = new Set(["c-1"]);

      // 迎えの家族枠児童抽出
      const inboundFamilyMap = new Map<string, any>();
      mockAttendances.forEach(a => {
        if (a.attendance_status === "absent" || a.status === "absent") return;
        if (a.status === "dropoff_only" || a.status === "no_transport") {
          const child = mockChildren.find(c => c.id === a.child_id);
          if (child && !inboundAssignedIds.has(a.child_id)) {
            inboundFamilyMap.set(a.child_id, { id: a.child_id, name: child.name, pickup_time: a.pickup_time });
          }
        }
      });

      const inboundFamilyList = Array.from(inboundFamilyMap.values()).sort((a, b) =>
        (a.pickup_time || "99:99").localeCompare(b.pickup_time || "99:99")
      );

      // 迎えの家族枠: 佐藤花子(14:30, dropoff_only) と 國分里穂(15:15, no_transport) が抽出される
      expect(inboundFamilyList.length).toBe(2);
      expect(inboundFamilyList[0].name).toBe("佐藤花子");
      expect(inboundFamilyList[0].pickup_time).toBe("14:30");
      expect(inboundFamilyList[1].name).toBe("國分里穂");
      expect(inboundFamilyList[1].pickup_time).toBe("15:15");

      // 送りの家族枠児童抽出
      const outboundAssignedIds = new Set(["c-1"]);
      const outboundFamilyMap = new Map<string, any>();
      mockAttendances.forEach(a => {
        if (a.attendance_status === "absent" || a.status === "absent") return;
        if (a.status === "pickup_only" || a.status === "no_transport") {
          const child = mockChildren.find(c => c.id === a.child_id);
          if (child && !outboundAssignedIds.has(a.child_id)) {
            outboundFamilyMap.set(a.child_id, { id: a.child_id, name: child.name, pickup_time: a.pickup_time });
          }
        }
      });

      const outboundFamilyList = Array.from(outboundFamilyMap.values()).sort((a, b) =>
        (a.pickup_time || "99:99").localeCompare(b.pickup_time || "99:99")
      );

      // 送りの家族枠: 國分里穂(15:15, no_transport) と 田中太郎(17:00, pickup_only) が抽出される
      expect(outboundFamilyList.length).toBe(2);
      expect(outboundFamilyList[0].name).toBe("國分里穂");
      expect(outboundFamilyList[0].pickup_time).toBe("15:15");
      expect(outboundFamilyList[1].name).toBe("田中太郎");
      expect(outboundFamilyList[1].pickup_time).toBe("17:00");
    });
  });

  describe("Transport Requirement Utilities (isPickupRequired, isDropoffRequired, isTransportRequired)", () => {
    it("correctly identifies when pickup is required", () => {
      expect(isPickupRequired("both")).toBe(true);
      expect(isPickupRequired("pickup_only")).toBe(true);
      expect(isPickupRequired("dropoff_only")).toBe(false);
      expect(isPickupRequired("no_transport")).toBe(false);
      expect(isPickupRequired("absent")).toBe(false);
      expect(isPickupRequired(null)).toBe(true); // default
    });

    it("correctly identifies when dropoff is required", () => {
      expect(isDropoffRequired("both")).toBe(true);
      expect(isDropoffRequired("dropoff_only")).toBe(true);
      expect(isDropoffRequired("pickup_only")).toBe(false);
      expect(isDropoffRequired("no_transport")).toBe(false);
      expect(isDropoffRequired("absent")).toBe(false);
      expect(isDropoffRequired(null)).toBe(true); // default
    });

    it("correctly delegates via isTransportRequired based on mode", () => {
      expect(isTransportRequired("inbound", "pickup_only")).toBe(true);
      expect(isTransportRequired("inbound", "dropoff_only")).toBe(false);
      expect(isTransportRequired("outbound", "pickup_only")).toBe(false);
      expect(isTransportRequired("outbound", "dropoff_only")).toBe(true);
      expect(isTransportRequired("outbound", "no_transport")).toBe(false);
    });
  });

  describe("Automatic Family Pickup Allocation and Staff Vehicle Exclusion", () => {
    it("automatically places unselected-dropoff children into family pickup and purges them from staff trips", () => {
      // 日別設定で「送り」がOFFの児童: child-2(pickup_only), child-3(no_transport)
      // 「送り」がONの児童: child-1(both), child-4(dropoff_only)
      const attendances = [
        { child_id: "c-1", attendance_status: "present", status: "both" },
        { child_id: "c-2", attendance_status: "present", status: "pickup_only" }, // 送りOFF
        { child_id: "c-3", attendance_status: "present", status: "no_transport" }, // 送りOFF
        { child_id: "c-4", attendance_status: "present", status: "dropoff_only" }, // 送りON
      ];

      // すでにDBに保存されていたスタッフ便（以前のデータで c-2 が乗ってしまっていたケース）
      const savedStaffColumns = [
        {
          id: "staff-1",
          staffName: "増子",
          trips: [
            {
              tripIndex: 1,
              children: [
                { id: "c-1", name: "児童1" },
                { id: "c-2", name: "児童2（送りOFFなのに便に入っている）" },
              ],
            },
          ],
        },
      ];

      // 1. 送りOFFの児童IDセット
      const outboundNoTransportIds = new Set(
        attendances.filter(a => !isDropoffRequired(a.status)).map(a => a.child_id)
      );
      expect(outboundNoTransportIds.has("c-2")).toBe(true);
      expect(outboundNoTransportIds.has("c-3")).toBe(true);
      expect(outboundNoTransportIds.has("c-1")).toBe(false);

      // 2. スタッフ便から送迎OFF児童を強制除外
      const cleanedColumns = savedStaffColumns.map(col => ({
        ...col,
        trips: col.trips.map(t => ({
          ...t,
          children: t.children.filter(c => !outboundNoTransportIds.has(c.id)),
        })),
      }));

      // c-2 がスタッフ便から完全に除外されたことを検証
      expect(cleanedColumns[0].trips[0].children.map(c => c.id)).toEqual(["c-1"]);

      // 3. 家族迎え枠への自動配置
      const familyPickupList = attendances
        .filter(a => !isDropoffRequired(a.status))
        .map(a => ({ id: a.child_id, name: `児童-${a.child_id}` }));

      expect(familyPickupList.map(c => c.id)).toEqual(["c-2", "c-3"]);

      // 4. 未割り当て候補（送迎が必要かつスタッフ便に乗っていない児童）
      const assignedIds = new Set(
        cleanedColumns.flatMap(col => col.trips.flatMap(t => t.children.map(c => c.id)))
      );
      const unassignedList = attendances
        .filter(a => isDropoffRequired(a.status) && !assignedIds.has(a.child_id))
        .map(a => ({ id: a.child_id, name: `児童-${a.child_id}` }));

      // c-4 のみが未割り当てに入る（c-2, c-3 は入らない）
      expect(unassignedList.map(c => c.id)).toEqual(["c-4"]);
    });

    it("excludes family pickup and no-transport children from auto-assignment candidate pool", () => {
      const allBoardChildren = [
        { id: "c-1", name: "児童1", transportMode: "both" },
        { id: "c-2", name: "児童2", transportMode: "pickup_only" }, // 送りOFF
        { id: "c-3", name: "児童3", transportMode: "no_transport" }, // 送りOFF
        { id: "c-4", name: "児童4", transportMode: "dropoff_only" }, // 送りON
      ];

      // 送りモードでの自動配車対象フィルタリング
      const filteredForAutoAssign = allBoardChildren.filter(c =>
        isTransportRequired("outbound", c.transportMode)
      );

      // c-2, c-3 は完全に除外されること
      expect(filteredForAutoAssign.map(c => c.id)).toEqual(["c-1", "c-4"]);
    });
  });
});
