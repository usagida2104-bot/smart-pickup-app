import { create } from "zustand";
import { BoardState, ChildMagnet, VehicleColumn } from "@/types";

interface BoardStore {
  inboundBoard: BoardState;
  outboundBoard: BoardState;
  setBoard: (mode: "inbound" | "outbound", board: BoardState) => void;
  moveChild: (
    mode: "inbound" | "outbound",
    childId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex?: number
  ) => void;
  isOverCapacity: (mode: "inbound" | "outbound", columnId: string) => boolean;
  updateColumnLocation: (mode: "inbound" | "outbound", columnId: string, locationType: "start" | "end", location: "office" | "home") => void;
  reorderChild: (mode: "inbound" | "outbound", columnId: string, childId: string, direction: -1 | 1) => void;
}

const emptyBoard: BoardState = {
  columns: [],
  unassigned: { id: "unassigned", children: [] },
};

export const useBoardStore = create<BoardStore>((set, get) => ({
  inboundBoard: { ...emptyBoard },
  outboundBoard: { ...emptyBoard },

  setBoard: (mode, board) => set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: board }),

  moveChild: (mode, childId, fromColumnId, toColumnId, toIndex) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;

    // Find and remove child from source
    let movedChild: ChildMagnet | undefined;
    let newUnassigned = [...board.unassigned.children];
    let newColumns = board.columns.map((col) => ({ ...col, children: [...col.children] }));

    if (fromColumnId === "unassigned") {
      const idx = newUnassigned.findIndex((c) => c.id === childId);
      if (idx !== -1) {
        movedChild = newUnassigned.splice(idx, 1)[0];
      }
    } else {
      const col = newColumns.find((c) => c.id === fromColumnId);
      if (col) {
        const idx = col.children.findIndex((c) => c.id === childId);
        if (idx !== -1) {
          movedChild = col.children.splice(idx, 1)[0];
        }
      }
    }

    if (!movedChild) return;

    // Insert child into destination
    if (toColumnId === "unassigned") {
      if (toIndex !== undefined) {
        newUnassigned.splice(toIndex, 0, movedChild);
      } else {
        newUnassigned.push(movedChild);
      }
    } else {
      const col = newColumns.find((c) => c.id === toColumnId);
      if (col) {
        if (toIndex !== undefined) {
          col.children.splice(toIndex, 0, movedChild);
        } else {
          col.children.push(movedChild);
        }
      }
    }

    set({
      [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: {
        columns: newColumns,
        unassigned: { id: "unassigned", children: newUnassigned },
      },
    });
  },

  isOverCapacity: (mode, columnId) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const col = board.columns.find((c) => c.id === columnId);
    if (!col) return false;
    return col.children.length > col.capacity;
  },

  updateColumnLocation: (mode, columnId, locationType, location) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const newColumns = board.columns.map((col) => {
      if (col.id === columnId) {
        return {
          ...col,
          ...(locationType === "start" ? { startLocation: location } : { endLocation: location })
        };
      }
      return col;
    });
    set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: { ...board, columns: newColumns } });
  },

  reorderChild: (mode, columnId, childId, direction) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const newColumns = board.columns.map((col) => ({ ...col, children: [...col.children] }));
    const col = newColumns.find(c => c.id === columnId);
    if (!col) return;
    
    const idx = col.children.findIndex(c => c.id === childId);
    if (idx === -1) return;
    
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= col.children.length) return;
    
    const temp = col.children[idx];
    col.children[idx] = col.children[newIdx];
    col.children[newIdx] = temp;
    
    set({
      [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: {
        ...board,
        columns: newColumns,
      }
    });
  },
}));
