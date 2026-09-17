import { create } from 'zustand';
export const useSidebarStore = create<{isOpen: boolean; setIsOpen: (val: boolean) => void; toggle: () => void;}>((set) => ({ isOpen: false, setIsOpen: (val) => set({ isOpen: val }), toggle: () => set((state) => ({ isOpen: !state.isOpen })) }));
