import { supabase } from "./client";
import { Child, DailyAttendance, School, Staff, Vehicle, BoardState } from "@/types";

// =====================
// マスターデータ取得
// =====================

export async function fetchMasterData() {
  const [
    { data: schools, error: errSchools },
    { data: vehicles, error: errVehicles },
    { data: staff, error: errStaff },
    { data: children, error: errChildren },
  ] = await Promise.all([
    supabase.from("schools").select("*"),
    supabase.from("vehicles").select("*"),
    supabase.from("staff").select("*"),
    supabase.from("children").select("*"),
  ]);

  if (errSchools) console.error("Error fetching schools", errSchools);
  if (errVehicles) console.error("Error fetching vehicles", errVehicles);
  if (errStaff) console.error("Error fetching staff", errStaff);
  if (errChildren) console.error("Error fetching children", errChildren);

  // 子供にschool情報を結合
  const schoolsFormatted = (schools || []).map((s: any) => ({
    ...s,
    default_dismissal_time: s.default_dismissal_time,
  }));

  const childrenWithSchool = (children || []).map((c: any) => ({
    ...c,
    homeAddress: c.home_address, // snake to camel
    weekly_schedule: c.weekly_schedule ?? [1, 2, 3, 4, 5], // default to Mon-Fri
    school: schoolsFormatted.find((s: any) => s.id === c.school_id) || null,
  }));

  const staffFormatted = (staff || []).map((s: any) => ({
    ...s,
    homeAddress: s.home_address,
    assignedVehicleId: s.assigned_vehicle_id,
  }));

  return {
    schools: schoolsFormatted as School[],
    vehicles: vehicles || [],
    staff: staffFormatted as Staff[],
    children: childrenWithSchool as Child[],
  };
}

// =====================
// トランザクション・ボード取得
// =====================

export async function fetchDailyData(targetDate: string) {
  const [
    { data: attendances, error: errAtts },
    { data: board, error: errBoard },
  ] = await Promise.all([
    supabase.from("daily_attendances").select("*").eq("target_date", targetDate),
    supabase.from("board_states").select("*").eq("target_date", targetDate).maybeSingle(),
  ]);

  if (errAtts) console.error("Error fetching attendances", errAtts);
  if (errBoard && errBoard.code !== 'PGRST116') console.error("Error fetching board states", errBoard); // PGRST116 is no rows

  return {
    attendances: (attendances || []) as DailyAttendance[],
    boardState: board || null, // { target_date, inbound_board, outbound_board }
  };
}

// =====================
// 書き込み・更新 (マスター)
// =====================

export async function upsertSchool(school: School) {
  const { error } = await supabase.from("schools").upsert({
    id: school.id,
    name: school.name,
    color_code: school.color_code,
    area: school.area,
    address: school.address,
    default_dismissal_time: school.default_dismissal_time,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteSchool(id: string) {
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertVehicle(vehicle: Vehicle) {
  const { error } = await supabase.from("vehicles").upsert({
    id: vehicle.id,
    name: vehicle.name,
    capacity: vehicle.capacity,
    vehicle_type: vehicle.vehicle_type,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteVehicle(id: string) {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertStaff(staff: Staff) {
  const { error } = await supabase.from("staff").upsert({
    id: staff.id,
    name: staff.name,
    is_driver: staff.is_driver,
    home_address: staff.homeAddress,
    assigned_vehicle_id: staff.assignedVehicleId,
    status: staff.status,
    status_time: staff.status_time,
    unit_name: staff.unit_name,
    role: staff.role,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteStaff(id: string) {
  const { error } = await supabase.from("staff").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertChild(child: Child) {
  const { error } = await supabase.from("children").upsert({
    id: child.id,
    name: child.name,
    school_id: child.school_id,
    unit_name: child.unit_name,
    has_caution: child.has_caution,
    notes: child.notes,
    home_address: child.homeAddress,
    status: child.status,
    status_time: child.status_time,
    weekly_schedule: child.weekly_schedule ?? [1, 2, 3, 4, 5],
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function deleteChild(id: string) {
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) throw error;
}

// =====================
// 書き込み・更新 (トランザクション)
// =====================

export async function upsertDailyAttendance(attendance: DailyAttendance) {
  const { error } = await supabase.from("daily_attendances").upsert({
    id: attendance.id,
    target_date: attendance.target_date,
    child_id: attendance.child_id,
    status: attendance.status,
    pickup_time: attendance.pickup_time,
    attendance_status: attendance.attendance_status ?? 'present',
    attendance_time: attendance.attendance_time ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "target_date,child_id" });
  
  if (error) throw error;
}

export async function saveBoardState(targetDate: string, inboundBoard: BoardState, outboundBoard: BoardState) {
  const { error } = await supabase.from("board_states").upsert({
    target_date: targetDate,
    inbound_board: inboundBoard as any,
    outbound_board: outboundBoard as any,
    updated_at: new Date().toISOString(),
  });
  
  if (error) throw error;
}
