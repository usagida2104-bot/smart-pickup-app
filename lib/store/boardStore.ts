import { create } from "zustand";
import { BoardState, ChildMagnet, VehicleColumn } from "@/types";

interface BoardStore {
  inboundBoard: BoardState;
  outboundBoard: BoardState;
  setBoard: (mode: "inbound" | "outbound", board: BoardState) => void;
  moveChild: (
    mode: "inbound" | "outbound",
    childId: string,
    fromDropZoneId: string,
    toDropZoneId: string,
    toIndex?: number
  ) => void;
  isOverCapacity: (mode: "inbound" | "outbound", tripId: string) => boolean;
  updateTripLocation: (mode: "inbound" | "outbound", tripId: string, locationType: "start" | "end", location: "office" | "home") => void;
  reorderChild: (mode: "inbound" | "outbound", tripId: string, childId: string, direction: -1 | 1) => void;
  addTrip: (mode: "inbound" | "outbound", columnId: string) => void;
}

const emptyBoard: BoardState = {
  columns: [],
  unassigned: { id: "unassigned", children: [] },
};

export const useBoardStore = create<BoardStore>((set, get) => ({
  inboundBoard: { ...emptyBoard },
  outboundBoard: { ...emptyBoard },

  setBoard: (mode, board) => set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: board }),

  moveChild: (mode, childId, fromDropZoneId, toDropZoneId, toIndex) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;

    let movedChild: ChildMagnet | undefined;
    let newUnassigned = [...board.unassigned.children];
    let newColumns = board.columns.map((col) => ({
      ...col,
      trips: col.trips.map(t => ({ ...t, children: [...t.children] }))
    }));

    if (fromDropZoneId === "unassigned") {
      const idx = newUnassigned.findIndex((c) => c.id === childId);
      if (idx !== -1) {
        movedChild = newUnassigned.splice(idx, 1)[0];
      }
    } else {
      for (const col of newColumns) {
        const trip = col.trips.find(t => t.id === fromDropZoneId);
        if (trip) {
          const idx = trip.children.findIndex((c) => c.id === childId);
          if (idx !== -1) {
            movedChild = trip.children.splice(idx, 1)[0];
            break;
          }
        }
      }
    }

    if (!movedChild) return;

    if (toDropZoneId === "unassigned") {
      if (toIndex !== undefined) {
        newUnassigned.splice(toIndex, 0, movedChild);
      } else {
        newUnassigned.push(movedChild);
      }
    } else {
      for (const col of newColumns) {
        const trip = col.trips.find(t => t.id === toDropZoneId);
        if (trip) {
          if (toIndex !== undefined) {
            trip.children.splice(toIndex, 0, movedChild);
          } else {
            trip.children.push(movedChild);
          }
          break;
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

  isOverCapacity: (mode, tripId) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    for (const col of board.columns) {
      const trip = col.trips.find(t => t.id === tripId);
      if (trip) {
        return trip.children.length > col.capacity;
      }
    }
    return false;
  },

  updateTripLocation: (mode, tripId, locationType, location) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const newColumns = board.columns.map((col) => {
      const hasTrip = col.trips.some(t => t.id === tripId);
      if (!hasTrip) return col;
      return {
        ...col,
        trips: col.trips.map(t => {
          if (t.id === tripId) {
            return {
              ...t,
              ...(locationType === "start" ? { startLocation: location } : { endLocation: location })
            };
          }
          return t;
        })
      };
    });
    set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: { ...board, columns: newColumns } });
  },

  reorderChild: (mode, tripId, childId, direction) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const newColumns = board.columns.map((col) => ({
      ...col,
      trips: col.trips.map(t => ({ ...t, children: [...t.children] }))
    }));
    
    for (const col of newColumns) {
      const trip = col.trips.find(t => t.id === tripId);
      if (trip) {
        const idx = trip.children.findIndex(c => c.id === childId);
        if (idx !== -1) {
          const newIdx = idx + direction;
          if (newIdx >= 0 && newIdx < trip.children.length) {
            const temp = trip.children[idx];
            trip.children[idx] = trip.children[newIdx];
            trip.children[newIdx] = temp;
          }
        }
        break;
      }
    }
    
    set({
      [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: {
        ...board,
        columns: newColumns,
      }
    });
  },

  addTrip: (mode, columnId) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const newColumns = board.columns.map((col) => {
      if (col.id === columnId) {
        const tripIndex = col.trips.length + 1;
        return {
          ...col,
          trips: [
            ...col.trips,
            {
              id: `${col.shiftId}-trip-${tripIndex}`,
              tripIndex,
              children: [],
            }
          ]
        };
      }
      return col;
    });
    set({ [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: { ...board, columns: newColumns } });
  },
}));
