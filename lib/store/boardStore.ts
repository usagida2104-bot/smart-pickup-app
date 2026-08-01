import { create } from "zustand";
import { BoardState, ChildMagnet, VehicleColumn } from "@/types";

interface BoardStore {
  board: BoardState;
  setBoard: (board: BoardState) => void;
  moveChild: (
    childId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex?: number
  ) => void;
  isOverCapacity: (columnId: string) => boolean;
}

const emptyBoard: BoardState = {
  columns: [],
  unassigned: { id: "unassigned", children: [] },
};

export const useBoardStore = create<BoardStore>((set, get) => ({
  board: emptyBoard,

  setBoard: (board) => set({ board }),

  moveChild: (childId, fromColumnId, toColumnId, toIndex) => {
    const { board } = get();

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
      board: {
        columns: newColumns,
        unassigned: { id: "unassigned", children: newUnassigned },
      },
    });
  },

  isOverCapacity: (columnId) => {
    const { board } = get();
    const col = board.columns.find((c) => c.id === columnId);
    if (!col) return false;
    return col.children.length > col.capacity;
  },
}));
