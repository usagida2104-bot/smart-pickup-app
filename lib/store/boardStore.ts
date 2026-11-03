import { create } from "zustand";
import { BoardState, ChildMagnet, VehicleColumn } from "@/types";
import { sortTripsByTime } from "@/lib/vehicleUtils";

interface BoardStore {
  inboundBoard: BoardState;
  outboundBoard: BoardState;
  setBoard: (mode: "inbound" | "outbound", board: BoardState) => void;
  assignChildToTrip: (
    mode: "inbound" | "outbound",
    childId: string | number,
    targetVehicleId: string | number,
    tripIndex?: number
  ) => void;
  moveChild: (
    mode: "inbound" | "outbound",
    childId: string,
    fromDropZoneId: string,
    toDropZoneId: string,
    toIndex?: number
  ) => void;
  isOverCapacity: (mode: "inbound" | "outbound", tripId: string) => boolean;
  updateTripVehicle: (
    mode: "inbound" | "outbound",
    columnId: string,
    tripId: string,
    vehicleId: string,
    vehicleName: string,
    capacity: number
  ) => void;
  updateTripTime: (
    mode: "inbound" | "outbound",
    columnId: string,
    tripId: string,
    newTime: string
  ) => void;
  updateTripLocation: (mode: "inbound" | "outbound", tripId: string, locationType: "start" | "end", location: "office" | "home") => void;
  reorderChild: (mode: "inbound" | "outbound", tripId: string, childId: string, direction: -1 | 1) => void;
  addTrip: (mode: "inbound" | "outbound", columnId: string, time?: string) => void;
  removeTrip: (mode: "inbound" | "outbound", columnId: string, tripId: string) => void;
}

const emptyBoard: BoardState = {
  columns: [],
  unassigned: { id: "unassigned", children: [] },
  familyPickup: { id: "family-pickup", children: [] },
};

export const useBoardStore = create<BoardStore>((set, get) => ({
  inboundBoard: { ...emptyBoard },
  outboundBoard: { ...emptyBoard },

  setBoard: (mode, board) => {
    const migratedColumns = (board?.columns || []).map(col => {
      const trips = (col.trips && col.trips.length > 0) ? col.trips : [
        {
          id: `${col.shiftId || col.id}-trip-1`,
          tripIndex: 1,
          departure_time: mode === "outbound" ? "17:00" : undefined,
          time: mode === "outbound" ? "17:00" : undefined,
          children: (col as any).children || []
        }
      ];
      const mappedTrips = trips.map((t: any, idx: number) => {
        const depTime = t.departure_time || t.time || (mode === "outbound" ? "17:00" : undefined);
        return {
          ...t,
          tripIndex: t.tripIndex || (idx + 1),
          departure_time: depTime,
          time: depTime,
          children: [...(t.children || [])]
        };
      });
      const sorted = sortTripsByTime(mappedTrips, mode);
      return {
        ...col,
        trips: sorted.map((t, idx) => ({ ...t, tripIndex: idx + 1 }))
      };
    });
    const familyPickup = board?.familyPickup ?? { id: "family-pickup" as const, children: [] };
    const unassigned = board?.unassigned ?? { id: "unassigned" as const, children: [] };

    set({
      [mode === "inbound" ? "inboundBoard" : "outboundBoard"]: {
        ...board,
        columns: migratedColumns,
        unassigned: { id: "unassigned", children: [...(unassigned.children || [])] },
        familyPickup: { id: "family-pickup", children: [...(familyPickup.children || [])] },
      }
    });
  },

  // 車両・便を指定して直接割り当てる確実なアクション
  assignChildToTrip: (mode, childId, targetVehicleId, tripIndex = 0) => {
    const state = get();
    const boardKey = mode === "inbound" ? "inboundBoard" : "outboundBoard";
    const currentBoard = state[boardKey];
    if (!currentBoard) return;

    const strChildId = String(childId);
    const strVehicleId = String(targetVehicleId);

    // 1. 対象の児童オブジェクトを取得（未割り当て、家族迎え、または全車両の便から探す）
    let targetChild: ChildMagnet | undefined = (currentBoard.unassigned?.children || []).find(
      c => String(c?.id || (c as any)?.child_id) === strChildId
    );
    if (!targetChild) {
      targetChild = (currentBoard.familyPickup?.children || []).find(
        c => String(c?.id || (c as any)?.child_id) === strChildId
      );
    }
    if (!targetChild) {
      for (const col of currentBoard.columns || []) {
        for (const t of col.trips || []) {
          const found = (t.children || []).find(c => String(c?.id || (c as any)?.child_id) === strChildId);
          if (found) {
            targetChild = found;
            break;
          }
        }
        if (targetChild) break;
      }
    }

    if (!targetChild) {
      console.error('[Assign] Target child not found anywhere:', strChildId);
      return;
    }

    // 2. 未割り当てリストおよび家族迎えから除外
    const newUnassigned = (currentBoard.unassigned?.children || []).filter(
      c => String(c?.id || (c as any)?.child_id) !== strChildId
    );
    const newFamilyPickup = (currentBoard.familyPickup?.children || []).filter(
      c => String(c?.id || (c as any)?.child_id) !== strChildId
    );

    // 3. 車両リストをディープコピーして更新（全車両の全便から除外した上で、対象車両・対象便に追加）
    let assigned = false;
    const newColumns = (currentBoard.columns || []).map(col => {
      const isTargetVehicle = String(col.vehicleId) === strVehicleId || String(col.id) === strVehicleId || String(col.staffId) === strVehicleId;

      const newTrips = (col.trips || []).map((trip, idx) => {
        // 一旦この児童を全便から削除（重複防止）
        const cleanedChildren = (trip.children || []).filter(
          c => String(c?.id || (c as any)?.child_id) !== strChildId
        );

        if (isTargetVehicle && (idx === tripIndex || trip.tripIndex === tripIndex + 1)) {
          assigned = true;
          return {
            ...trip,
            children: [...cleanedChildren, targetChild!]
          };
        }
        return {
          ...trip,
          children: cleanedChildren
        };
      });

      // もし対象便が存在しなかった場合は自動生成して追加
      if (isTargetVehicle && !assigned) {
        newTrips.push({
          id: `${col.shiftId || col.id}-trip-${tripIndex + 1}`,
          tripIndex: tripIndex + 1,
          children: [targetChild!]
        });
        assigned = true;
      }

      return {
        ...col,
        trips: newTrips
      };
    });

    console.log('[Assign Success]', { mode, childId: strChildId, targetVehicleId: strVehicleId, tripIndex, assigned });

    set({
      [boardKey]: {
        ...currentBoard,
        unassigned: { id: "unassigned", children: newUnassigned },
        familyPickup: { id: "family-pickup", children: newFamilyPickup },
        columns: newColumns
      }
    });
  },

  moveChild: (mode, childId, fromDropZoneId, toDropZoneId, toIndex) => {
    const state = get();
    const boardKey = mode === "inbound" ? "inboundBoard" : "outboundBoard";
    const board = state[boardKey];
    const strChildId = String(childId ?? '');

    // 1. 移動元を問わず、該当児童オブジェクトを特定
    let movedChild: ChildMagnet | undefined;
    
    // 全体から探す
    const allPools = [
      ...(board.unassigned?.children || []),
      ...(board.familyPickup?.children || []),
      ...(board.columns || []).flatMap(c => (c.trips || []).flatMap(t => t.children || []))
    ];
    movedChild = allPools.find(c => String(c?.id || (c as any)?.child_id) === strChildId);

    if (!movedChild) {
      console.warn("moveChild: movedChild not found for id:", strChildId);
      return;
    }

    // 2. 全プール・全車両から該当児童を完全除外（イミュータブル）
    let newUnassigned = (board.unassigned?.children || []).filter(
      c => String(c?.id || (c as any)?.child_id) !== strChildId
    );
    let newFamilyPickup = (board.familyPickup?.children || []).filter(
      c => String(c?.id || (c as any)?.child_id) !== strChildId
    );
    let newColumns = (board.columns || []).map((col) => ({
      ...col,
      trips: (col.trips || []).map(t => ({
        ...t,
        children: (t.children || []).filter(c => String(c?.id || (c as any)?.child_id) !== strChildId)
      }))
    }));

    // 3. 移動先に追加
    if (toDropZoneId === "unassigned") {
      if (toIndex !== undefined) {
        newUnassigned.splice(toIndex, 0, movedChild);
      } else {
        newUnassigned.push(movedChild);
      }
      console.log('[Assign Success: to unassigned]', { mode, childId: strChildId });
    } else if (toDropZoneId === "family-pickup") {
      if (toIndex !== undefined) {
        newFamilyPickup.splice(toIndex, 0, movedChild);
      } else {
        newFamilyPickup.push(movedChild);
      }
      console.log('[Assign Success: to family-pickup]', { mode, childId: strChildId });
    } else {
      // 車両便への追加（toDropZoneId が trip.id または vehicleId または shiftId のいずれかにマッチ）
      let foundTargetTrip = false;
      for (const col of newColumns) {
        // trip.id または col.id または col.staffId または col.vehicleId で照合
        const trip = (col.trips || []).find(
          t => String(t?.id ?? '') === String(toDropZoneId ?? '') ||
               String(col?.id ?? '') === String(toDropZoneId ?? '') ||
               String(col?.staffId ?? '') === String(toDropZoneId ?? '') ||
               String(col?.vehicleId ?? '') === String(toDropZoneId ?? '')
        );

        if (trip) {
          foundTargetTrip = true;
          if (toIndex !== undefined) {
            trip.children.splice(toIndex, 0, movedChild);
          } else {
            trip.children.push(movedChild);
          }
          trip.isNew = false;
          console.log('[Assign Success]', {
            mode,
            childId: strChildId,
            targetVehicleId: col.vehicleId,
            targetTripIndex: trip.tripIndex,
            passengersCount: trip.children.length
          });
          break;
        }
      }

      // もし既存トリップで見つからず、toDropZoneId が車両IDそのものだった場合
      if (!foundTargetTrip) {
        for (const col of newColumns) {
          if (String(col.vehicleId) === String(toDropZoneId) || String(col.id) === String(toDropZoneId) || String(col.staffId) === String(toDropZoneId)) {
            if ((col.trips || []).length === 0) {
              col.trips = [{ id: `${col.shiftId || col.id}-trip-1`, tripIndex: 1, children: [movedChild] }];
            } else {
              col.trips[0].children.push(movedChild);
            }
            foundTargetTrip = true;
            console.log('[Assign Success: fallback to vehicle 1st trip]', { mode, childId: strChildId, vehicleId: col.vehicleId });
            break;
          }
        }
      }

      if (!foundTargetTrip) {
        console.error("moveChild: Target trip/vehicle not found for toDropZoneId:", toDropZoneId);
        // 見つからなかった場合は未割り当てに戻す（消失防止）
        newUnassigned.push(movedChild);
      }
    }

    set({
      [boardKey]: {
        ...board,
        columns: newColumns,
        unassigned: { id: "unassigned", children: newUnassigned },
        familyPickup: { id: "family-pickup", children: newFamilyPickup },
      },
    });
  },

  isOverCapacity: (mode, tripId) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    for (const col of board.columns) {
      const trip = (col.trips || []).find(t => t.id === tripId);
      if (trip) {
        const cap = trip.capacity || col.capacity || 99;
        return (trip.children || []).length > cap;
      }
    }
    return false;
  },

  updateTripVehicle: (mode, columnId, tripId, vehicleId, vehicleName, capacity) => {
    const state = get();
    const boardKey = mode === "inbound" ? "inboundBoard" : "outboundBoard";
    const board = state[boardKey];
    const strColId = String(columnId);
    const strTripId = String(tripId);

    const newColumns = (board.columns || []).map((col) => {
      const isTargetCol = String(col.id) === strColId ||
                          String(col.shiftId) === strColId ||
                          String(col.staffId) === strColId ||
                          String(col.driverId) === strColId ||
                          (col.trips || []).some(t => String(t.id) === strTripId);

      if (!isTargetCol) return col;

      const newTrips = (col.trips || []).map((t, idx) => {
        const isTargetTrip = String(t.id) === strTripId ||
                             String(t.tripIndex) === strTripId ||
                             idx === Number(tripId);
        if (isTargetTrip) {
          return {
            ...t,
            vehicleId: vehicleId || null,
            vehicleName: vehicleName || "車両未選択",
            capacity: Number(capacity) || 6,
          };
        }
        return t;
      });

      return {
        ...col,
        // 1便目ならカラム全体の車両名・キャパシティも同期
        capacity: newTrips[0]?.capacity || col.capacity,
        vehicleName: newTrips[0]?.vehicleName || col.vehicleName,
        trips: newTrips,
      };
    });

    set({
      [boardKey]: {
        ...board,
        columns: newColumns,
      },
    });
  },

  updateTripLocation: (mode, tripId, locationType, location) => {
    const state = get();
    const board = mode === "inbound" ? state.inboundBoard : state.outboundBoard;
    const newColumns = board.columns.map((col) => {
      const hasTrip = (col.trips || []).some(t => t.id === tripId);
      if (!hasTrip) return col;
      return {
        ...col,
        trips: (col.trips || []).map(t => {
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
      trips: (col.trips || []).map(t => ({ ...t, children: [...t.children] }))
    }));
    
    for (const col of newColumns) {
      const trip = (col.trips || []).find(t => t.id === tripId);
      if (trip) {
        const idx = trip.children.findIndex(c => c.id === childId);
        if (idx !== -1) {
          const newIdx = idx + direction;
          if (newIdx >= 0 && newIdx < (trip.children || []).length) {
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

  updateTripTime: (mode, columnId, tripId, newTime) => {
    const state = get();
    const boardKey = mode === "inbound" ? "inboundBoard" : "outboundBoard";
    const board = state[boardKey];
    const newColumns = board.columns.map((col) => {
      if (
        col.id === columnId ||
        col.shiftId === columnId ||
        col.staffId === columnId ||
        (col.trips || []).some((t) => t.id === tripId)
      ) {
        const updatedTrips = (col.trips || []).map((t) => {
          if (t.id === tripId) {
            return {
              ...t,
              departure_time: newTime,
              time: newTime,
            };
          }
          return t;
        });
        const sorted = sortTripsByTime(updatedTrips, mode);
        return {
          ...col,
          trips: sorted.map((t, idx) => ({ ...t, tripIndex: idx + 1 })),
        };
      }
      return col;
    });
    set({ [boardKey]: { ...board, columns: newColumns } });
  },

  addTrip: (mode, columnId, time) => {
    const state = get();
    const boardKey = mode === "inbound" ? "inboundBoard" : "outboundBoard";
    const board = state[boardKey];
    const newColumns = board.columns.map((col) => {
      if (col.id === columnId || col.shiftId === columnId || col.staffId === columnId) {
        const existingTrips = col.trips || [];
        const nextIndex = existingTrips.length + 1;
        const lastTrip = existingTrips.length > 0 ? existingTrips[existingTrips.length - 1] : null;

        let departureTime: string | undefined = undefined;
        if (mode === "outbound") {
          if (time) {
            departureTime = time;
          } else {
            // 既存便と重複しない時刻をサジェスト（17:00, 17:30, 16:30, 18:00...）
            const existingTimes = new Set(existingTrips.map((t) => t.departure_time || t.time || "17:00"));
            const candidates = ["17:00", "17:30", "16:30", "18:00", "16:00", "18:30", "15:30", "19:00"];
            departureTime = candidates.find((c) => !existingTimes.has(c)) || "17:30";
          }
        }

        const newTrip = {
          id: `${col.shiftId || col.id}-trip-${Date.now()}-${nextIndex}`,
          tripIndex: nextIndex,
          departure_time: departureTime,
          time: departureTime,
          vehicleId: lastTrip?.vehicleId || null,
          vehicleName: lastTrip?.vehicleName || "車両未選択",
          capacity: lastTrip?.capacity || col.capacity || 6,
          children: [],
          isNew: true,
        };

        const combinedTrips = [...existingTrips, newTrip];
        const sorted = sortTripsByTime(combinedTrips, mode);

        return {
          ...col,
          trips: sorted.map((t, idx) => ({ ...t, tripIndex: idx + 1 })),
        };
      }
      return col;
    });
    set({ [boardKey]: { ...board, columns: newColumns } });
  },

  removeTrip: (mode, columnId, tripId) => {
    const state = get();
    const boardKey = mode === "inbound" ? "inboundBoard" : "outboundBoard";
    const board = state[boardKey];

    let removedChildren: ChildMagnet[] = [];

    const newColumns = (board.columns || []).map((col) => {
      if (col.id === columnId || col.vehicleId === columnId) {
        // 削除対象の便に乗っている児童を退避
        const targetTrip = (col.trips || []).find((t) => t.id === tripId);
        if (targetTrip && targetTrip.children) {
          removedChildren.push(...targetTrip.children);
        }

        // 対象便を除外
        const filteredTrips = (col.trips || []).filter((t) => t.id !== tripId);

        // 残った便をソート＆リナンバリング
        const sortedTrips = sortTripsByTime(filteredTrips, mode);
        const renumberedTrips = sortedTrips.map((t, idx) => ({
          ...t,
          tripIndex: idx + 1,
        }));

        return {
          ...col,
          trips: renumberedTrips,
        };
      }
      return col;
    });

    // 削除された便に乗っていた児童を未割り当てリストへ安全に戻す
    const newUnassigned = [
      ...(board.unassigned?.children || []),
      ...removedChildren,
    ];

    console.log('[Remove Trip Success]', {
      mode,
      columnId,
      tripId,
      returnedChildrenCount: removedChildren.length,
    });

    set({
      [boardKey]: {
        ...board,
        columns: newColumns,
        unassigned: {
          id: "unassigned",
          children: newUnassigned,
        },
      },
    });
  },
}));
