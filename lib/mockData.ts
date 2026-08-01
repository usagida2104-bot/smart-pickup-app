import { Child, DailyAttendance, DailyShift, School, Staff, Vehicle } from "@/types";

export const MOCK_SCHOOLS: School[] = [
  { id: "school-1", name: "さくら小学校", color_code: "#F87171" },
  { id: "school-2", name: "ひまわり小学校", color_code: "#60A5FA" },
  { id: "school-3", name: "もみじ小学校", color_code: "#34D399" },
  { id: "school-4", name: "つばき小学校", color_code: "#FBBF24" },
];

export const MOCK_VEHICLES: Vehicle[] = [
  { id: "vehicle-1", name: "ステップワゴン", capacity: 6, vehicle_type: "minivan" },
  { id: "vehicle-2", name: "シエンタ", capacity: 4, vehicle_type: "compact" },
  { id: "vehicle-3", name: "N-BOX", capacity: 3, vehicle_type: "k-car" },
];

export const MOCK_STAFF: Staff[] = [
  { id: "staff-1", name: "田中 太郎", is_driver: true },
  { id: "staff-2", name: "鈴木 花子", is_driver: true },
  { id: "staff-3", name: "佐藤 次郎", is_driver: true },
  { id: "staff-4", name: "山田 美咲", is_driver: false },
];

export const MOCK_CHILDREN: Child[] = [
  { id: "child-1", name: "青山 一郎", school_id: "school-1", unit_name: "ぽっけ", has_caution: false, notes: null, school: MOCK_SCHOOLS[0] },
  { id: "child-2", name: "井上 二子", school_id: "school-1", unit_name: "ぽっけ", has_caution: true, notes: "車酔いしやすい", school: MOCK_SCHOOLS[0] },
  { id: "child-3", name: "上田 三郎", school_id: "school-2", unit_name: "ぽっけ2", has_caution: false, notes: null, school: MOCK_SCHOOLS[1] },
  { id: "child-4", name: "江本 四花", school_id: "school-2", unit_name: "ぽっけ2", has_caution: false, notes: null, school: MOCK_SCHOOLS[1] },
  { id: "child-5", name: "大谷 五平", school_id: "school-3", unit_name: "ぽっけ", has_caution: true, notes: "補助が必要", school: MOCK_SCHOOLS[2] },
  { id: "child-6", name: "加藤 六恵", school_id: "school-3", unit_name: "ぽっけ2", has_caution: false, notes: null, school: MOCK_SCHOOLS[2] },
  { id: "child-7", name: "木村 七夏", school_id: "school-4", unit_name: "ぽっけ", has_caution: false, notes: null, school: MOCK_SCHOOLS[3] },
  { id: "child-8", name: "黒木 八朗", school_id: "school-4", unit_name: "ぽっけ2", has_caution: false, notes: null, school: MOCK_SCHOOLS[3] },
  { id: "child-9", name: "小林 九美", school_id: "school-1", unit_name: "ぽっけ", has_caution: false, notes: null, school: MOCK_SCHOOLS[0] },
  { id: "child-10", name: "斉藤 十作", school_id: "school-2", unit_name: "ぽっけ2", has_caution: false, notes: null, school: MOCK_SCHOOLS[1] },
];

export const TODAY = new Date().toISOString().split("T")[0];

export const MOCK_DAILY_ATTENDANCE: DailyAttendance[] = [
  { id: "att-1", target_date: TODAY, child_id: "child-1", status: "present", pickup_time: "14:10", child: MOCK_CHILDREN[0] },
  { id: "att-2", target_date: TODAY, child_id: "child-2", status: "present", pickup_time: "14:10", child: MOCK_CHILDREN[1] },
  { id: "att-3", target_date: TODAY, child_id: "child-3", status: "present", pickup_time: "14:30", child: MOCK_CHILDREN[2] },
  { id: "att-4", target_date: TODAY, child_id: "child-4", status: "absent", pickup_time: null, child: MOCK_CHILDREN[3] },
  { id: "att-5", target_date: TODAY, child_id: "child-5", status: "present", pickup_time: "15:00", child: MOCK_CHILDREN[4] },
  { id: "att-6", target_date: TODAY, child_id: "child-6", status: "parent_pickup", pickup_time: null, child: MOCK_CHILDREN[5] },
  { id: "att-7", target_date: TODAY, child_id: "child-7", status: "present", pickup_time: "14:30", child: MOCK_CHILDREN[6] },
  { id: "att-8", target_date: TODAY, child_id: "child-8", status: "present", pickup_time: "15:00", child: MOCK_CHILDREN[7] },
  { id: "att-9", target_date: TODAY, child_id: "child-9", status: "present", pickup_time: "14:10", child: MOCK_CHILDREN[8] },
  { id: "att-10", target_date: TODAY, child_id: "child-10", status: "present", pickup_time: "14:30", child: MOCK_CHILDREN[9] },
];

export const MOCK_DAILY_SHIFTS: DailyShift[] = [
  {
    id: "shift-1",
    target_date: TODAY,
    vehicle_id: "vehicle-1",
    driver_id: "staff-1",
    vehicle: MOCK_VEHICLES[0],
    driver: MOCK_STAFF[0],
  },
  {
    id: "shift-2",
    target_date: TODAY,
    vehicle_id: "vehicle-2",
    driver_id: "staff-2",
    vehicle: MOCK_VEHICLES[1],
    driver: MOCK_STAFF[1],
  },
  {
    id: "shift-3",
    target_date: TODAY,
    vehicle_id: "vehicle-3",
    driver_id: "staff-3",
    vehicle: MOCK_VEHICLES[2],
    driver: MOCK_STAFF[2],
  },
];
