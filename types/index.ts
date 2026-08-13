// =====================
// マスターエンティティ
// =====================

export interface School {
  id: string;
  name: string;
  color_code: string | null;
  area?: string | null;
  address?: string | null;
  default_dismissal_time?: string | null;
}

export interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  vehicle_type: "minivan" | "compact" | "k-car" | null;
  is_active?: boolean;
}

export interface Staff {
  id: string;
  name: string;
  is_driver: boolean;
  homeAddress?: string | null;
  assignedVehicleId?: string | null;
  status?: "present" | "absent" | "late" | "early_leave";
  status_time?: string | null;
  unit_name?: string | null;
  role?: string | null;
}

export interface Child {
  id: string;
  name: string;
  school_id: string | null;
  unit_name: string | null;
  has_caution: boolean;
  notes: string | null;
  homeAddress?: string | null;
  status?: "present" | "absent" | "late" | "early_leave";
  status_time?: string | null;
  weekly_schedule?: number[];
  display_order?: number;
  default_dismissal_time?: string | null;
  // join
  school?: School | null;
}

// =====================
// トランザクション
// =====================

export type TransportMode = "both" | "pickup_only" | "dropoff_only" | "no_transport" | "absent";

export interface DailyAttendance {
  id: string;
  target_date: string; // ISO date string
  child_id: string;
  status: TransportMode;
  pickup_time: string | null; // "HH:MM"
  attendance_status: "present" | "absent" | "late" | "early_leave";
  attendance_time: string | null;
  // join
  child?: Child;
}

export interface DailyStaff {
  id: string;
  target_date: string;
  staff_id: string;
  status: "present" | "absent" | "late" | "early_leave";
  status_time: string | null;
  role?: string | null;
  // join
  staff?: Staff;
}

export interface DailyVehicle {
  id: string;
  target_date: string;
  vehicle_id: string;
  is_active: boolean;
  // join
  vehicle?: Vehicle;
}

export interface DailyShift {
  id: string;
  target_date: string;
  vehicle_id: string;
  driver_id: string;
  // join
  vehicle?: Vehicle | null;
  driver?: Staff | null;
}

export interface TransportAssignment {
  id: string;
  target_date: string;
  pickup_time: string;
  daily_shift_id: string;
  child_id: string;
  order_index: number;
  // join
  child?: Child | null;
}

// =====================
// DnD ボード用
// =====================

/** ドラッグ可能な「マグネット」(児童カード) */
export interface ChildMagnet {
  id: string; // child.id
  childId: string;
  name: string;
  color: string; // school color_code
  has_caution: boolean;
  pickup_time: string | null;
  school_name: string;
  school_area?: string | null;
  unit_name: string | null;
  notes: string | null;
  transportMode: TransportMode;
  status?: "present" | "absent" | "late" | "early_leave";
  status_time?: string | null;
}

export type LocationOption = "office" | "home";

/** ドラッグ先の「車両カラム」 */
export interface VehicleColumn {
  id: string; // daily_shift.id
  shiftId: string;
  vehicleId: string;
  vehicleName: string;
  driverId: string;
  driverName: string;
  driverStatus?: "present" | "absent" | "late" | "early_leave";
  driverStatusTime?: string | null;
  capacity: number;
  startLocation?: LocationOption;
  endLocation?: LocationOption;
  routeInfo?: string;
  estimatedTime?: number;
  children: ChildMagnet[];
}

/** 未割り当てプール */
export interface UnassignedPool {
  id: "unassigned";
  children: ChildMagnet[];
}

/** ボード全体の状態 */
export interface BoardState {
  columns: VehicleColumn[];
  unassigned: UnassignedPool;
}

// =====================
// autoAssignVehicles 用
// =====================

export interface AssignInput {
  attendances: DailyAttendance[];
  shifts: DailyShift[];
}

export interface AssignResult {
  columns: VehicleColumn[];
  unassigned: ChildMagnet[];
}
