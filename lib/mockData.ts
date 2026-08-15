import { Child, DailyAttendance, DailyShift, School, Staff, Vehicle, BoardState, ChildMagnet } from "@/types";

export const TODAY = new Date().toISOString().split("T")[0];

export const MOCK_SCHOOLS: School[] = [
  { id: "school-1", name: "ぽっけ", color_code: "#F87171", area: "北エリア", address: "宮城県仙台市青葉区", default_dismissal_time: "14:30" }, // Red
  { id: "school-2", name: "ぽっけ2", color_code: "#60A5FA", area: "南エリア", address: "宮城県仙台市太白区", default_dismissal_time: "15:00" }, // Blue
  { id: "school-3", name: "日中一時", color_code: "#34D399", area: "北エリア", address: "宮城県仙台市青葉区", default_dismissal_time: "14:45" }, // Green
  { id: "school-4", name: "自宅/その他", color_code: "#FBBF24", area: "その他", address: "未設定", default_dismissal_time: "15:30" }, // Yellow
];

export const MOCK_VEHICLES: Vehicle[] = [
  { id: "v-stepwgn", name: "ステップワゴン", capacity: 8, vehicle_type: "minivan" },
  { id: "v-voxy", name: "VOXY", capacity: 8, vehicle_type: "minivan" },
  { id: "v-nvan", name: "Nバン", capacity: 4, vehicle_type: "k-car" },
  { id: "v-isis", name: "アイシス", capacity: 7, vehicle_type: "minivan" },
  { id: "v-spacia", name: "SPACIA", capacity: 4, vehicle_type: "k-car" },
  { id: "v-boon", name: "BOON", capacity: 5, vehicle_type: "compact" },
  { id: "v-sienta", name: "Sienta", capacity: 7, vehicle_type: "compact" },
  { id: "v-note", name: "NOTE", capacity: 5, vehicle_type: "compact" },
  { id: "v-every", name: "Every", capacity: 4, vehicle_type: "k-car" },
];

export const OFFICE_ADDRESS = "福島県郡山市大槻町字天正坦28-4";

export const MOCK_STAFF: Staff[] = [
  { id: "s-usami", name: "宇佐見", is_driver: true, homeAddress: "福島県郡山市富久山町", assignedVehicleId: "v-stepwgn" },
  { id: "s-masuko", name: "増子", is_driver: true, homeAddress: "福島県郡山市安積町", assignedVehicleId: "v-voxy" },
  { id: "s-uchiyama", name: "内山", is_driver: true, homeAddress: "福島県郡山市開成", assignedVehicleId: "v-nvan" },
  { id: "s-tsuchi", name: "つち", is_driver: true, homeAddress: "福島県郡山市大槻町", assignedVehicleId: "v-isis" },
  { id: "s-ohira", name: "大平", is_driver: true, homeAddress: "福島県郡山市菜根", assignedVehicleId: "v-spacia" },
  { id: "s-suda", name: "須田", is_driver: true, homeAddress: "福島県郡山市桑野", assignedVehicleId: "v-boon" },
  { id: "s-kumada", name: "熊田", is_driver: true, homeAddress: "福島県郡山市並木", assignedVehicleId: "v-sienta" },
  { id: "s-yanai", name: "矢内", is_driver: true, homeAddress: "福島県郡山市八山田", assignedVehicleId: "v-note" },
  { id: "s-rijicho", name: "理事長", is_driver: true, homeAddress: "福島県郡山市駅前", assignedVehicleId: "v-sienta" },
  { id: "s-takamiya", name: "高宮", is_driver: true, homeAddress: "福島県郡山市日和田町", assignedVehicleId: "v-every" },
];

// Helper to create child
const createChild = (
  id: string,
  name: string,
  school_id: string,
  unit: string | null = null,
  has_caution = false,
  notes: string | null = null,
  homeAddress: string | null = null
): Child => {
  const school = MOCK_SCHOOLS.find((s) => s.id === school_id);
  return { id, name, school_id, unit_name: unit, has_caution, notes, school, homeAddress };
};

export const MOCK_CHILDREN: Child[] = [
  createChild("c-sato", "佐藤", "school-1", "ぽっけ1", true, "車酔いしやすい", "福島県郡山市富田町"),
  createChild("c-suzuki", "鈴木", "school-1", "ぽっけ2", false, null, "福島県郡山市久留米"),
  createChild("c-takahashi", "高橋", "school-1", "ぽっけ1", false, null, "福島県郡山市安積町"),
  createChild("c-tanaka", "田中", "school-1", null, false, null, "福島県郡山市桑野"),
  createChild("c-ito", "伊藤", "school-2", null, true, "特定の子とトラブルになりやすい", "福島県郡山市朝日"),
  createChild("c-watanabe", "渡辺", "school-2", "日中一時", false, null, "福島県郡山市大槻町"),
  createChild("c-yamamoto", "山本", "school-2", "ぽっけ1", false, null, "福島県郡山市菜根"),
  createChild("c-nakamura", "中村", "school-2", "ぽっけ2", true, "シートベルト外す", "福島県郡山市並木"),
  createChild("c-kobayashi", "小林", "school-3", "ぽっけ1", false, null, "福島県郡山市八山田"),
  createChild("c-kato", "加藤", "school-3", "日中一時", false, null, "福島県郡山市日和田町"),
  createChild("c-yoshida", "吉田", "school-4", null, false, null, "福島県郡山市本町"),
  createChild("c-yamada", "山田", "school-4", "ぽっけ2", true, "大声出す", "福島県郡山市駅前"),
];

// Helper to create attendance
const createAttendance = (child_id: string, status: string, pickup_time: string | null): DailyAttendance => {
  const child = MOCK_CHILDREN.find(c => c.id === child_id)!;
  return {
    id: `att-${child_id}`,
    target_date: "2024-05-20",
    child_id,
    status: status as any,
    pickup_time,
    attendance_status: "present",
    attendance_time: null,
    child,
  };
};

export const MOCK_DAILY_ATTENDANCE: DailyAttendance[] = [
  createAttendance("c-sato", "both", "14:30"),
  createAttendance("c-suzuki", "both", "15:00"),
  createAttendance("c-takahashi", "pickup_only", "15:00"),
  createAttendance("c-tanaka", "absent", null),
  createAttendance("c-ito", "both", "14:30"),
  createAttendance("c-watanabe", "dropoff_only", "15:30"),
  createAttendance("c-yamamoto", "both", "15:00"),
  createAttendance("c-nakamura", "no_transport", "15:00"),
  createAttendance("c-kobayashi", "both", "14:30"),
  createAttendance("c-kato", "both", "15:00"),
  createAttendance("c-yoshida", "both", "15:30"),
  createAttendance("c-yamada", "both", "15:00"),
];

// Helper to create shift
const createShift = (id: string, vId: string, sId: string): DailyShift => {
  const vehicle = MOCK_VEHICLES.find(v => v.id === vId)!;
  const driver = MOCK_STAFF.find(s => s.id === sId)!;
  return { id, target_date: TODAY, vehicle_id: vId, driver_id: sId, vehicle, driver };
};

export const MOCK_DAILY_SHIFTS: DailyShift[] = [
  createShift("shift-1", "v-stepwgn", "s-usami"),
  createShift("shift-2", "v-voxy", "s-masuko"),
  createShift("shift-3", "v-nvan", "s-uchiyama"),
  createShift("shift-4", "v-isis", "s-tsuchi"),
  createShift("shift-5", "v-spacia", "s-ohira"),
  createShift("shift-6", "v-boon", "s-suda"),
  createShift("shift-7", "v-sienta", "s-kumada"),
  createShift("shift-8", "v-note", "s-yanai"),
  createShift("shift-9", "v-sienta", "s-rijicho"),
  createShift("shift-10", "v-every", "s-takamiya"),
];

// ─────────────────────────────────────────
// ホワイトボード状態を再現する BoardState
// ─────────────────────────────────────────
// ---
// Helpers for conversion
// ---
export function toMagnet(childId: string, allChildren?: Child[] | any, allAttendances?: DailyAttendance[] | any): ChildMagnet {
  const safeChildren = Array.isArray(allChildren) ? allChildren : (MOCK_CHILDREN || []);
  const safeAttendances = Array.isArray(allAttendances) ? allAttendances : (MOCK_DAILY_ATTENDANCE || []);
  const child = safeChildren.find((c) => c.id === childId);
  const att = safeAttendances.find((a: DailyAttendance) => a.child_id === childId);
  
  if (!child) {
    return {
      id: childId,
      childId: childId,
      name: "不明な児童",
      color: "#ccc",
      has_caution: false,
      pickup_time: null,
      school_name: "",
      school_area: null,
      unit_name: "",
      notes: "データ不整合",
      transportMode: "both",
      status: "present",
      status_time: null,
    };
  }

  return {
    id: child.id,
    childId: child.id,
    name: child.name,
    color: child.school?.color_code ?? "#ccc",
    has_caution: child.has_caution,
    pickup_time: (att?.pickup_time && att.pickup_time.trim() !== "") 
      ? att.pickup_time 
      : (child.default_dismissal_time && child.default_dismissal_time.trim() !== "")
        ? child.default_dismissal_time
        : (child.school?.default_dismissal_time && child.school.default_dismissal_time.trim() !== "")
          ? child.school.default_dismissal_time
          : null,
    school_name: child.school?.name ?? "",
    school_area: child.school?.area ?? null,
    unit_name: child.unit_name,
    notes: child.notes,
    transportMode: att?.status ?? "both",
    status: (att?.attendance_status && att.attendance_status !== "present" ? att.attendance_status : child.status) as any,
    status_time: att?.attendance_time || child.status_time,
  };
}

export const MOCK_WHITEBOARD_STATE: BoardState = {
  columns: [
    {
      id: "shift-1", shiftId: "shift-1", vehicleId: "v-stepwgn", vehicleName: "ステップワゴン", driverId: "staff-1", driverName: "宇佐見", capacity: 8,
      children: ["c-sato", "c-suzuki", "c-takahashi"].map(id => toMagnet(id))
    },
    {
      id: "shift-2", shiftId: "shift-2", vehicleId: "v-voxy", vehicleName: "VOXY", driverId: "staff-2", driverName: "増子", capacity: 8,
      children: []
    },
    {
      id: "shift-3", shiftId: "shift-3", vehicleId: "v-nvan", vehicleName: "Nバン", driverId: "staff-3", driverName: "内山", capacity: 4,
      children: ["c-ito", "c-watanabe"].map(id => toMagnet(id))
    },
    {
      id: "shift-4", shiftId: "shift-4", vehicleId: "v-isis", vehicleName: "アイシス", driverId: "staff-4", driverName: "つち", capacity: 7,
      children: ["c-yamamoto"].map(id => toMagnet(id))
    },
    {
      id: "shift-5", shiftId: "shift-5", vehicleId: "v-spacia", vehicleName: "SPACIA", driverId: "staff-5", driverName: "大平", capacity: 4,
      children: ["c-kobayashi"].map(id => toMagnet(id))
    },
    {
      id: "shift-6", shiftId: "shift-6", vehicleId: "v-boon", vehicleName: "BOON", driverId: "staff-6", driverName: "須田", capacity: 5,
      children: ["c-kato", "c-yoshida"].map(id => toMagnet(id))
    },
    {
      id: "shift-7", shiftId: "shift-7", vehicleId: "v-sienta", vehicleName: "Sienta", driverId: "staff-7", driverName: "熊田", capacity: 7,
      children: ["c-yamada"].map(id => toMagnet(id))
    },
    {
      id: "shift-8", shiftId: "shift-8", vehicleId: "v-note", vehicleName: "NOTE", driverId: "staff-8", driverName: "矢内", capacity: 5,
      children: []
    },
    {
      id: "shift-9", shiftId: "shift-9", vehicleId: "v-sienta", vehicleName: "Sienta", driverId: "staff-9", driverName: "理事長", capacity: 7,
      children: []
    },
    {
      id: "shift-10", shiftId: "shift-10", vehicleId: "v-every", vehicleName: "Every", driverId: "staff-10", driverName: "高宮", capacity: 4,
      children: []
    }
  ],
  unassigned: {
    id: "unassigned",
    children: [] 
  }
};
