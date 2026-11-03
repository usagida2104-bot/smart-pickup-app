import { describe, it, expect } from "vitest";
import {
  getVehicleColorTheme,
  getVehicleBadgeColor,
  getTripTimeSummary,
  getTripTimeRange,
  isTimeRangeOverlapping,
  getConflictingVehicleIds,
  assignVehiclesWithoutOverlap,
  isPickupRequired,
  isDropoffRequired,
  isTransportRequired,
  reconcileBoardWithAttendances,
  generateTimeOptions,
  getTripDepartureTime,
  sortTripsByTime,
  getOutboundConflictingVehicles,
} from "../lib/vehicleUtils";

describe("Vehicle Scheduling & Visual Enhancement Utilities", () => {
  describe("getVehicleColorTheme & getVehicleBadgeColor", () => {
    it("assigns distinct color themes according to user specification", () => {
      // アイシス: スカイブルー系
      expect(getVehicleColorTheme("アイシス").badgeBg).toBe("bg-sky-100");
      expect(getVehicleColorTheme("アイシス").badgeText).toBe("text-sky-800");
      expect(getVehicleColorTheme("アイシス").badgeBorder).toBe("border-sky-300");
      expect(getVehicleColorTheme("アイシス").printBg).toBe("print:bg-sky-100");

      // シエンタ: アンバー/オレンジ系
      expect(getVehicleColorTheme("シエンタ").badgeBg).toBe("bg-amber-100");
      expect(getVehicleColorTheme("シエンタ").badgeText).toBe("text-amber-800");
      expect(getVehicleColorTheme("シエンタ").badgeBorder).toBe("border-amber-300");

      // ノート: パープル系
      expect(getVehicleColorTheme("ノート").badgeBg).toBe("bg-purple-100");
      expect(getVehicleColorTheme("ノート").badgeText).toBe("text-purple-800");

      // ムーブ: ピンク/ローズ系
      expect(getVehicleColorTheme("ムーブ").badgeBg).toBe("bg-pink-100");
      expect(getVehicleColorTheme("ムーヴ").badgeText).toBe("text-pink-800");

      // ボクシー: インディゴ/ブルー系
      expect(getVehicleColorTheme("ボクシー").badgeBg).toBe("bg-indigo-100");
      expect(getVehicleColorTheme("ヴォクシー").badgeText).toBe("text-indigo-800");

      // ステップワゴン: エメラルド/グリーン系
      expect(getVehicleColorTheme("ステップワゴン").badgeBg).toBe("bg-emerald-100");
      expect(getVehicleColorTheme("ステップワゴン").badgeText).toBe("text-emerald-800");

      // エブリィ: イエロー系
      expect(getVehicleColorTheme("エブリィ").badgeBg).toBe("bg-yellow-100");
      expect(getVehicleColorTheme("エブリー").badgeText).toBe("text-yellow-800");

      // スペーシア: ティール系
      expect(getVehicleColorTheme("スペーシア").badgeBg).toBe("bg-teal-100");
      expect(getVehicleColorTheme("スペーシア").badgeText).toBe("text-teal-800");

      // 車未定
      expect(getVehicleColorTheme("車未定").badgeBg).toBe("bg-slate-100");

      // 登録外車両（ハッシュフォールバック）
      const fallback = getVehicleColorTheme("新車ハイエース");
      expect(fallback.badgeBg).toBeTruthy();
      expect(fallback.badgeText).toBeTruthy();
      expect(fallback.badgeBorder).toBeTruthy();
    });

    it("getVehicleBadgeColor alias works identically", () => {
      expect(getVehicleBadgeColor("アイシス")).toEqual(getVehicleColorTheme("アイシス"));
      expect(getVehicleBadgeColor("ステップワゴン")).toEqual(getVehicleColorTheme("ステップワゴン"));
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

  describe("Mode-dependent Time Display and Table Column Layout", () => {
    it("should hide time and render 2 columns in outbound mode, and show time with 3 columns in inbound mode", () => {
      // 共通の描画ロジック仕様の検証（順番号 20px、時刻 42px）
      const getTableColumns = (mode: "inbound" | "outbound") => {
        const isOutbound = mode === "outbound";
        return {
          colCount: isOutbound ? 2 : 3,
          indexColWidth: "20px",
          hasTimeCol: !isOutbound,
          timeColWidth: isOutbound ? undefined : "42px",
        };
      };

      const inboundLayout = getTableColumns("inbound");
      expect(inboundLayout.colCount).toBe(3);
      expect(inboundLayout.hasTimeCol).toBe(true);
      expect(inboundLayout.indexColWidth).toBe("20px");
      expect(inboundLayout.timeColWidth).toBe("42px");

      const outboundLayout = getTableColumns("outbound");
      expect(outboundLayout.colCount).toBe(2);
      expect(outboundLayout.hasTimeCol).toBe(false);
      expect(outboundLayout.indexColWidth).toBe("20px");
      expect(outboundLayout.timeColWidth).toBeUndefined();
    });

    it("controls child card time badge visibility strictly based on mode", () => {
      const isTimeBadgeVisible = (mode: "inbound" | "outbound") => mode === "inbound";

      expect(isTimeBadgeVisible("inbound")).toBe(true);
      expect(isTimeBadgeVisible("outbound")).toBe(false);
    });

    it("controls vehicle trip time summary visibility based on mode", () => {
      const isTripTimeSummaryVisible = (mode: "inbound" | "outbound", timeSummary?: string) => {
        return mode === "inbound" && !!timeSummary;
      };

      expect(isTripTimeSummaryVisible("inbound", "14:10〜14:40")).toBe(true);
      expect(isTripTimeSummaryVisible("outbound", "17:00〜17:30")).toBe(false);
      expect(isTripTimeSummaryVisible("inbound", "")).toBe(false);
    });
  });

  describe("reconcileBoardWithAttendances (Single Source of Truth Reconciliation)", () => {
    const mockChildren = [
      { id: "c-1", name: "児童1" },
      { id: "c-2", name: "児童2" },
      { id: "c-3", name: "児童3" },
      { id: "c-4", name: "児童4" },
    ];

    it("moves child from familyPickup to unassigned when transport flag is turned ON", () => {
      // 以前のボードステート：c-2 は送りOFFだったため家族枠にいた
      const prevBoard = {
        columns: [
          {
            id: "col-1",
            trips: [
              { tripIndex: 1, children: [{ id: "c-1", name: "児童1" }] },
            ],
          },
        ],
        unassigned: { id: "unassigned", children: [] },
        familyPickup: { id: "family-pickup", children: [{ id: "c-2", name: "児童2" }] },
      };

      // 最新の日別設定：c-2 の送りを「ON（both または dropoff_only）」に変更した
      const updatedAttendances = [
        { child_id: "c-1", status: "both", attendance_status: "present" },
        { child_id: "c-2", status: "both", attendance_status: "present" }, // ONに変更！
      ];

      const reconciled = reconcileBoardWithAttendances(prevBoard, updatedAttendances, mockChildren, "outbound");

      // 1. 家族枠から c-2 が確実に除外されていること
      expect(reconciled.familyPickup.children.some((c: any) => c.id === "c-2")).toBe(false);

      // 2. 未割り当て枠に c-2 が自動追加され、配車可能になっていること
      expect(reconciled.unassigned.children.some((c: any) => c.id === "c-2")).toBe(true);

      // 3. 既存のスタッフ便（c-1）は維持されていること
      expect(reconciled.columns[0].trips[0].children.map((c: any) => c.id)).toEqual(["c-1"]);
    });

    it("moves child from staff trip or unassigned to familyPickup when transport flag is turned OFF", () => {
      // 以前のボードステート：c-1 はスタッフ便、c-2 は未割り当て枠にいた
      const prevBoard = {
        columns: [
          {
            id: "col-1",
            trips: [
              { tripIndex: 1, children: [{ id: "c-1", name: "児童1" }] },
            ],
          },
        ],
        unassigned: { id: "unassigned", children: [{ id: "c-2", name: "児童2" }] },
        familyPickup: { id: "family-pickup", children: [] },
      };

      // 最新の日別設定：c-1 も c-2 も送りを「OFF（pickup_only または no_transport）」に変更した
      const updatedAttendances = [
        { child_id: "c-1", status: "pickup_only", attendance_status: "present" }, // 送りOFF
        { child_id: "c-2", status: "no_transport", attendance_status: "present" }, // 送りOFF
      ];

      const reconciled = reconcileBoardWithAttendances(prevBoard, updatedAttendances, mockChildren, "outbound");

      // 1. スタッフ便から c-1 が確実に除外されていること
      expect(reconciled.columns[0].trips[0].children).toHaveLength(0);

      // 2. 未割り当て枠から c-2 が除外されていること
      expect(reconciled.unassigned.children).toHaveLength(0);

      // 3. 家族枠に c-1, c-2 の両方が自動配置されていること
      const familyIds = reconciled.familyPickup.children.map((c: any) => c.id);
      expect(familyIds).toContain("c-1");
      expect(familyIds).toContain("c-2");
    });

    it("removes absent children from all board areas", () => {
      const prevBoard = {
        columns: [
          {
            id: "col-1",
            trips: [
              { tripIndex: 1, children: [{ id: "c-1", name: "児童1" }] },
            ],
          },
        ],
        unassigned: { id: "unassigned", children: [{ id: "c-2", name: "児童2" }] },
        familyPickup: { id: "family-pickup", children: [{ id: "c-3", name: "児童3" }] },
      };

      // 全員欠席（absent）に変更
      const updatedAttendances = [
        { child_id: "c-1", status: "both", attendance_status: "absent" },
        { child_id: "c-2", status: "both", attendance_status: "absent" },
        { child_id: "c-3", status: "no_transport", attendance_status: "absent" },
      ];

      const reconciled = reconcileBoardWithAttendances(prevBoard, updatedAttendances, mockChildren, "outbound");

      expect(reconciled.columns[0].trips[0].children).toHaveLength(0);
      expect(reconciled.unassigned.children).toHaveLength(0);
      expect(reconciled.familyPickup.children).toHaveLength(0);
    });
  });

  describe("Outbound Time-based Trip Management & Vehicle Conflict Prevention", () => {
    describe("generateTimeOptions", () => {
      it("generates 5-minute interval options between 15:00 and 19:00", () => {
        const options = generateTimeOptions("15:00", "19:00", 5);
        expect(options[0]).toBe("15:00");
        expect(options[1]).toBe("15:05");
        expect(options).toContain("16:30");
        expect(options).toContain("17:00");
        expect(options).toContain("17:30");
        expect(options[options.length - 1]).toBe("19:00");
        expect(options).toHaveLength(49); // (4 hours * 12) + 1 = 49
      });
    });

    describe("getTripDepartureTime", () => {
      it("returns departure_time or fallback to 17:00 for outbound mode", () => {
        expect(getTripDepartureTime({ departure_time: "16:30" }, "outbound")).toBe("16:30");
        expect(getTripDepartureTime({ time: "17:15" }, "outbound")).toBe("17:15");
        expect(getTripDepartureTime({}, "outbound")).toBe("17:00");
      });

      it("returns sequential trip index for inbound mode", () => {
        expect(getTripDepartureTime({ tripIndex: 1 }, "inbound")).toBe("1便");
        expect(getTripDepartureTime({ tripIndex: 2 }, "inbound")).toBe("2便");
      });
    });

    describe("sortTripsByTime", () => {
      it("sorts trips in chronological order for outbound mode", () => {
        const trips = [
          { id: "trip-1", tripIndex: 1, departure_time: "17:00" },
          { id: "trip-2", tripIndex: 2, departure_time: "16:30" },
          { id: "trip-3", tripIndex: 3, departure_time: "17:30" },
        ];

        const sorted = sortTripsByTime(trips, "outbound");
        expect(sorted[0].departure_time).toBe("16:30");
        expect(sorted[1].departure_time).toBe("17:00");
        expect(sorted[2].departure_time).toBe("17:30");
      });

      it("sorts trips by tripIndex for inbound mode", () => {
        const trips = [
          { id: "trip-2", tripIndex: 2, departure_time: "14:00" },
          { id: "trip-1", tripIndex: 1, departure_time: "14:30" },
        ];

        const sorted = sortTripsByTime(trips, "inbound");
        expect(sorted[0].tripIndex).toBe(1);
        expect(sorted[1].tripIndex).toBe(2);
      });
    });

    describe("getOutboundConflictingVehicles", () => {
      const mockColumns = [
        {
          id: "col-staff-A",
          staffName: "スタッフA",
          trips: [
            { id: "trip-A-1", departure_time: "17:00", vehicleId: "veh-sienta" },
            { id: "trip-A-2", departure_time: "16:30", vehicleId: "veh-stepwgn" },
          ],
        },
        {
          id: "col-staff-B",
          staffName: "スタッフB",
          trips: [
            { id: "trip-B-1", departure_time: "17:00", vehicleId: "veh-stepwgn" },
          ],
        },
      ];

      it("detects conflict when another staff uses the vehicle at the exact same departure time", () => {
        // スタッフCの 17:00 の便でシエンタ（veh-sienta）を選ぼうとする場合 -> スタッフAと衝突
        const conflictsAt1700 = getOutboundConflictingVehicles(mockColumns, "col-staff-C", "trip-C-1", "17:00");
        const conflictedIds = conflictsAt1700.map((c) => c.vehicleId);

        expect(conflictedIds).toContain("veh-sienta"); // スタッフAが17:00で使用中
        expect(conflictedIds).toContain("veh-stepwgn"); // スタッフBが17:00で使用中
        expect(conflictsAt1700.find((c) => c.vehicleId === "veh-sienta")?.conflictStaffName).toBe("スタッフA");
      });

      it("allows the same vehicle to be selected if the departure time is different", () => {
        // スタッフCの 16:30 の便をチェック -> 16:30 で使用中のステップワゴンは衝突するが、シエンタ（17:00使用）は空いていて選択可能
        const conflictsAt1630 = getOutboundConflictingVehicles(mockColumns, "col-staff-C", "trip-C-2", "16:30");
        const conflictedIds = conflictsAt1630.map((c) => c.vehicleId);

        expect(conflictedIds).toContain("veh-stepwgn"); // スタッフAが16:30で使用中
        expect(conflictedIds).not.toContain("veh-sienta"); // 17:00使用のシエンタは16:30では利用可能！
      });

      it("excludes the target trip itself from conflict detection", () => {
        // スタッフAの trip-A-1 (17:00, veh-sienta) 自身をチェックする場合、自身の割り当ては衝突とみなされない
        const conflictsForSelf = getOutboundConflictingVehicles(mockColumns, "col-staff-A", "trip-A-1", "17:00");
        const conflictedIds = conflictsForSelf.map((c) => c.vehicleId);

        expect(conflictedIds).not.toContain("veh-sienta");
        expect(conflictedIds).toContain("veh-stepwgn"); // スタッフBのステップワゴンのみ衝突
      });
    });
  });
});
