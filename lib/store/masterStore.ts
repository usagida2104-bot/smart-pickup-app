import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Staff, Vehicle, School, Child, DailyAttendance } from "@/types";
import { MOCK_STAFF, MOCK_VEHICLES, MOCK_SCHOOLS, MOCK_CHILDREN, MOCK_DAILY_ATTENDANCE } from "@/lib/mockData";

interface MasterStore {
  staff: Staff[];
  vehicles: Vehicle[];
  schools: School[];
  children: Child[];
  attendances: DailyAttendance[];
  
  // Attendances actions
  setAttendances: (atts: DailyAttendance[]) => void;
  // Staff actions
  addStaff: (staff: Staff) => void;
  updateStaff: (id: string, staff: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;
  
  // Vehicle actions
  addVehicle: (vehicle: Vehicle) => void;
  updateVehicle: (id: string, vehicle: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;

  // School actions
  addSchool: (school: School) => void;
  updateSchool: (id: string, school: Partial<School>) => void;
  deleteSchool: (id: string) => void;

  // Child actions
  addChild: (child: Child) => void;
  updateChild: (id: string, child: Partial<Child>) => void;
  deleteChild: (id: string) => void;
}

export const useMasterStore = create<MasterStore>()(
  persist(
    (set) => ({
      staff: MOCK_STAFF || [],
      vehicles: MOCK_VEHICLES || [],
      schools: MOCK_SCHOOLS || [],
      children: MOCK_CHILDREN || [],
      attendances: MOCK_DAILY_ATTENDANCE || [],
      
      setAttendances: (atts) => set(() => ({ attendances: atts })),
      
      addStaff: (newStaff) => set((state) => ({ staff: [...state.staff, newStaff] })),
      updateStaff: (id, updated) => set((state) => ({
        staff: state.staff.map(s => s.id === id ? { ...s, ...updated } : s)
      })),
      deleteStaff: (id) => set((state) => ({
        staff: state.staff.filter(s => s.id !== id)
      })),

      addVehicle: (newVehicle) => set((state) => ({ vehicles: [...state.vehicles, newVehicle] })),
      updateVehicle: (id, updated) => set((state) => ({
        vehicles: state.vehicles.map(v => v.id === id ? { ...v, ...updated } : v)
      })),
      deleteVehicle: (id) => set((state) => ({
        vehicles: state.vehicles.filter(v => v.id !== id)
      })),

      addSchool: (newSchool) => set((state) => ({ schools: [...state.schools, newSchool] })),
      updateSchool: (id, updated) => set((state) => ({
        schools: state.schools.map(s => s.id === id ? { ...s, ...updated } : s),
        children: state.children.map(c => 
          c.school_id === id 
            ? { ...c, school: { ...c.school!, ...updated } } 
            : c
        )
      })),
      deleteSchool: (id) => set((state) => ({
        schools: state.schools.filter(s => s.id !== id),
        children: state.children.map(c => 
          c.school_id === id 
            ? { ...c, school_id: null, school: null } 
            : c
        )
      })),

      addChild: (newChild) => set((state) => ({ children: [...state.children, newChild] })),
      updateChild: (id, updated) => set((state) => ({
        children: state.children.map(c => {
          if (c.id === id) {
            const newSchoolId = updated.school_id !== undefined ? updated.school_id : c.school_id;
            const newSchool = state.schools.find(s => s.id === newSchoolId) || null;
            return { ...c, ...updated, school: newSchool };
          }
          return c;
        })
      })),
      deleteChild: (id) => set((state) => ({
        children: state.children.filter(c => c.id !== id)
      })),
    }),
    {
      name: "master_data_store",
      partialize: (state) => ({
        staff: state.staff,
        vehicles: state.vehicles,
        schools: state.schools,
        children: state.children,
      }),
    }
  )
);
