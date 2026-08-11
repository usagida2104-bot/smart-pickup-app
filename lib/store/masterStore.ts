import { create } from "zustand";
import { Staff, Vehicle, School, Child, DailyAttendance } from "@/types";
import { 
  fetchMasterData,
  upsertStaff, deleteStaff,
  upsertVehicle, deleteVehicle,
  upsertSchool, deleteSchool,
  upsertChild, deleteChild,
  updateChildrenOrder
} from "../supabase/service";

interface MasterStore {
  staff: Staff[];
  vehicles: Vehicle[];
  schools: School[];
  children: Child[];
  attendances: DailyAttendance[];
  
  // 初期ロードと状態上書き用 (Realtime Sync等から呼ばれる)
  setMasterData: (data: { staff: Staff[], vehicles: Vehicle[], schools: School[], children: Child[] }) => void;
  setAttendances: (atts: DailyAttendance[]) => void;
  
  // Staff actions
  addStaff: (staff: Staff) => Promise<void>;
  updateStaff: (id: string, staff: Partial<Staff>) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  
  // Vehicle actions
  addVehicle: (vehicle: Vehicle) => Promise<void>;
  updateVehicle: (id: string, vehicle: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;

  // School actions
  addSchool: (school: School) => Promise<void>;
  updateSchool: (id: string, school: Partial<School>) => Promise<void>;
  deleteSchool: (id: string) => Promise<void>;

  // Child actions
  addChild: (child: Child) => Promise<void>;
  updateChild: (id: string, child: Partial<Child>) => Promise<void>;
  deleteChild: (id: string) => Promise<void>;
  reorderChild: (id: string, direction: -1 | 1) => Promise<void>;
}

export const useMasterStore = create<MasterStore>((set, get) => ({
  staff: [],
  vehicles: [],
  schools: [],
  children: [],
  attendances: [],
  
  setMasterData: (data) => set(() => ({ ...data })),
  setAttendances: (atts) => set(() => ({ attendances: atts })),
  
  addStaff: async (newStaff) => {
    // 楽観的更新
    set((state) => ({ staff: [...state.staff, newStaff] }));
    await upsertStaff(newStaff);
  },
  updateStaff: async (id, updated) => {
    const state = get();
    const target = state.staff.find(s => s.id === id);
    if (!target) return;
    const newTarget = { ...target, ...updated };
    
    set((state) => ({
      staff: state.staff.map(s => s.id === id ? newTarget : s)
    }));
    await upsertStaff(newTarget);
  },
  deleteStaff: async (id) => {
    set((state) => ({ staff: state.staff.filter(s => s.id !== id) }));
    await deleteStaff(id);
  },

  addVehicle: async (newVehicle) => {
    set((state) => ({ vehicles: [...state.vehicles, newVehicle] }));
    await upsertVehicle(newVehicle);
  },
  updateVehicle: async (id, updated) => {
    const state = get();
    const target = state.vehicles.find(v => v.id === id);
    if (!target) return;
    const newTarget = { ...target, ...updated };

    set((state) => ({
      vehicles: state.vehicles.map(v => v.id === id ? newTarget : v)
    }));
    await upsertVehicle(newTarget);
  },
  deleteVehicle: async (id) => {
    set((state) => ({ vehicles: state.vehicles.filter(v => v.id !== id) }));
    await deleteVehicle(id);
  },

  addSchool: async (newSchool) => {
    set((state) => ({ schools: [...state.schools, newSchool] }));
    await upsertSchool(newSchool);
  },
  updateSchool: async (id, updated) => {
    const state = get();
    const target = state.schools.find(s => s.id === id);
    if (!target) return;
    const newTarget = { ...target, ...updated };

    set((state) => ({
      schools: state.schools.map(s => s.id === id ? newTarget : s),
      children: state.children.map(c => 
        c.school_id === id ? { ...c, school: { ...c.school!, ...updated } } : c
      )
    }));
    await upsertSchool(newTarget);
  },
  deleteSchool: async (id) => {
    set((state) => ({
      schools: state.schools.filter(s => s.id !== id),
      children: state.children.map(c => c.school_id === id ? { ...c, school_id: null, school: null } : c)
    }));
    await deleteSchool(id);
  },

  addChild: async (newChild) => {
    set((state) => ({ children: [...state.children, newChild] }));
    await upsertChild(newChild);
  },
  updateChild: async (id, updated) => {
    const state = get();
    const target = state.children.find(c => c.id === id);
    if (!target) return;
    const newTarget = { ...target, ...updated };

    set((state) => ({
      children: state.children.map(c => {
        if (c.id === id) {
          const newSchoolId = updated.school_id !== undefined ? updated.school_id : c.school_id;
          const newSchool = state.schools.find(s => s.id === newSchoolId) || null;
          return { ...newTarget, school: newSchool };
        }
        return c;
      })
    }));
    await upsertChild(newTarget);
  },
  deleteChild: async (id) => {
    set((state) => ({ children: state.children.filter(c => c.id !== id) }));
    await deleteChild(id);
  },
  reorderChild: async (id, direction) => {
    const state = get();
    const children = [...state.children];
    const index = children.findIndex(c => c.id === id);
    if (index === -1) return;
    
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= children.length) return;
    
    const child = children[index];
    children.splice(index, 1);
    children.splice(targetIndex, 0, child);
    
    const updatedChildren = children.map((c, i) => ({ ...c, display_order: i }));
    set({ children: updatedChildren });
    
    await updateChildrenOrder(updatedChildren.map(c => ({ id: c.id, display_order: c.display_order })));
  },
}));
