import { create } from 'zustand';
import { PatchCable, Jack } from '../types/synth';

export const CABLE_COLORS = [
  '#ff4d6d', '#ff9500', '#ffe033', '#4ade80', '#38bdf8',
  '#a78bfa', '#f472b6', '#fb923c', '#34d399', '#60a5fa',
];

interface PatchStore {
  cables: PatchCable[];
  jacks: Record<string, Jack>;
  draggingFrom: string | null;
  mousePos: { x: number; y: number };
  nextColor: number;

  registerJack: (jack: Jack) => void;
  unregisterJack: (jackId: string) => void;
  updateJackPosition: (jackId: string, x: number, y: number) => void;
  startDrag: (jackId: string) => void;
  setMousePos: (x: number, y: number) => void;
  completePatch: (toJackId: string) => void;
  cancelDrag: () => void;
  removeCable: (cableId: string) => void;
  removeJackCables: (jackId: string) => void;
  resetCables: () => void;
  getCablesForJack: (jackId: string) => PatchCable[];
}

// Memoized selectors to prevent unnecessary re-renders
export const selectCables = (state: PatchStore) => state.cables;
export const selectJacks = (state: PatchStore) => state.jacks;
export const selectDraggingFrom = (state: PatchStore) => state.draggingFrom;
export const selectMousePos = (state: PatchStore) => state.mousePos;
export const selectCablesAndJacks = (state: PatchStore) => ({ cables: state.cables, jacks: state.jacks });
export const selectDragState = (state: PatchStore) => ({
  draggingFrom: state.draggingFrom,
  mousePos: state.mousePos,
  jacks: state.jacks,
  cables: state.cables,
});

export const usePatchStore = create<PatchStore>((set, get) => ({
  cables: [],
  jacks: {},
  draggingFrom: null,
  mousePos: { x: 0, y: 0 },
  nextColor: 0,

  registerJack: (jack) =>
    set((s) => ({ jacks: { ...s.jacks, [jack.id]: jack } })),

  unregisterJack: (jackId) =>
    set((s) => {
      const { [jackId]: _, ...rest } = s.jacks;
      return { jacks: rest };
    }),

  updateJackPosition: (jackId, x, y) =>
    set((s) => ({
      jacks: {
        ...s.jacks,
        [jackId]: { ...s.jacks[jackId], x, y },
      },
    })),

  startDrag: (jackId) => set({ draggingFrom: jackId }),
  setMousePos: (x, y) => set({ mousePos: { x, y } }),

  completePatch: (toJackId) => {
    const { draggingFrom, jacks, cables, nextColor } = get();
    
    // Validate drag
    if (!draggingFrom || draggingFrom === toJackId) {
      set({ draggingFrom: null });
      return;
    }
    
    const fromJack = jacks[draggingFrom];
    const toJack = jacks[toJackId];
    
    // Validate both jacks exist and are different types
    if (!fromJack || !toJack || fromJack.type === toJack.type) {
      set({ draggingFrom: null });
      return;
    }
    
    // Normalize to output→input order
    const [output, input] = fromJack.type === 'output' 
      ? [fromJack, toJack] 
      : [toJack, fromJack];

    // Skip if cable already exists
    if (cables.some((c) => c.fromJackId === output.id && c.toJackId === input.id)) {
      set({ draggingFrom: null });
      return;
    }

    // Create new cable (input can only have one source, output can fan out)
    const newCable: PatchCable = {
      id: `cable_${Date.now()}`,
      fromJackId: output.id,
      toJackId: input.id,
      color: CABLE_COLORS[nextColor % CABLE_COLORS.length],
    };

    set({
      cables: [...cables.filter((c) => c.toJackId !== input.id), newCable],
      draggingFrom: null,
      nextColor: nextColor + 1,
    });
  },

  cancelDrag: () => set({ draggingFrom: null }),

  removeCable: (cableId) =>
    set((s) => ({ cables: s.cables.filter((c) => c.id !== cableId) })),

  removeJackCables: (jackId) =>
    set((s) => ({
      cables: s.cables.filter(
        (c) => c.fromJackId !== jackId && c.toJackId !== jackId
      ),
    })),

  resetCables: () => set({ cables: [] }),
  setCables: (cables) => set({ cables }),

  getCablesForJack: (jackId) => {
    return get().cables.filter(
      (c) => c.fromJackId === jackId || c.toJackId === jackId
    );
  },
}));
