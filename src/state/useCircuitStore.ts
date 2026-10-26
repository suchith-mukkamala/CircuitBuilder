import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { starterCircuit } from '../circuit/sample';
import {
  CircuitDocument, CircuitComponent, ComponentKind, Selection, Rotation, Point,
  WireEndpoint, Wire, DCResult, TransientResult, id, snap, isTerminal, isCircuitDocument,
} from '../circuit/types';
import { solveDC } from '../simulation/dc';
import { runTransient } from '../simulation/transient';

export type Clipboard = { components: CircuitComponent[]; wires: Wire[] };
type WireSide = 'from' | 'to';
type CircuitStore = {
  document: CircuitDocument;
  selection: Selection;
  selectedIds: string[];
  pendingPin: WireEndpoint | null;
  simulation: DCResult | null;
  transient: TransientResult | null;
  analysisMode: 'dc' | 'transient';
  transientDuration: number;
  transientSteps: number;
  timeIndex: number;
  showFlow: boolean;
  message: string;
  past: CircuitDocument[];
  future: CircuitDocument[];
  dragSnapshot: CircuitDocument | null;
  clipboard: Clipboard | null;
  pasteCount: number;
  addComponent: (kind: ComponentKind, at: Point) => void;
  moveComponent: (id: string, at: Point) => void;
  moveFreeEnd: (wireId: string, side: WireSide, at: Point) => void;
  straightenWire: (wireId: string) => void;
  beginDrag: () => void;
  endDrag: () => void;
  rotateComponent: (id: string) => void;
  setComponentValue: (id: string, value: number) => void;
  toggleSwitch: (id: string) => void;
  setPotWiper: (id: string, value: number) => void;
  rename: (name: string) => void;
  select: (selection: Selection, additive?: boolean) => void;
  selectAll: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  undo: () => void;
  redo: () => void;
  setFlowEnabled: (enabled: boolean) => void;
  startOrFinishWire: (endpoint: WireEndpoint) => void;
  beginWire: (endpoint: WireEndpoint) => void;
  cancelWire: () => void;
  removeSelection: () => void;
  newCircuit: () => void;
  loadDocument: (doc: unknown) => void;
  simulate: () => void;
  simulateTransient: () => void;
  setTransientDuration: (seconds: number) => void;
  setTransientSteps: (steps: number) => void;
  setTimeIndex: (index: number) => void;
  save: () => void;
};

const freshValue: Record<ComponentKind, number> = {
  resistor: 1000, voltage_source: 5, current_source: .005,
  ground: 0, switch: 0, potentiometer: 1000,
  capacitor: .0001, inductor: .1,
};
const invalidated = {
  simulation: null, transient: null, analysisMode: 'dc' as const,
  timeIndex: 0,
  message: 'Circuit updated · run DC or TRANSIENT to refresh results.',
};
const emptyDocument = (): CircuitDocument => ({
  version: 1, name: 'Untitled circuit', components: [], wires: [],
});
const limitHistory = (history: CircuitDocument[]) => history.slice(-80);
const edit = (
  state: CircuitStore,
  doc: CircuitDocument,
  extra: Partial<CircuitStore> = {},
): Partial<CircuitStore> => ({
  document: doc,
  // Pointer drags record a SINGLE history entry at drag completion.
  ...(state.dragSnapshot ? {} : {
    past: limitHistory([...state.past, state.document]),
    future: [],
  }),
  ...invalidated,
  ...extra,
});
const equalEndpoint = (a: WireEndpoint, b: WireEndpoint) =>
  isTerminal(a) && isTerminal(b)
    ? a.componentId === b.componentId && a.pin === b.pin
    : !isTerminal(a) && !isTerminal(b) && a.x === b.x && a.y === b.y;

function clipboardOf(doc: CircuitDocument, componentIds: string[]): Clipboard | null {
  const ids = new Set(componentIds);
  const components = doc.components.filter(c => ids.has(c.id));
  if (components.length === 0) return null;
  const wires = doc.wires.filter(w =>
    (!isTerminal(w.from) || ids.has(w.from.componentId)) &&
    (!isTerminal(w.to) || ids.has(w.to.componentId)) &&
    ((isTerminal(w.from) && ids.has(w.from.componentId)) ||
     (isTerminal(w.to) && ids.has(w.to.componentId))));
  return {
    components: components.map(c => ({ ...c })),
    wires: wires.map(w => ({
      ...w,
      from: { ...w.from }, to: { ...w.to },
      waypoints: w.waypoints?.map(p => ({ ...p })),
    })),
  };
}

export const useCircuitStore = create<CircuitStore>()(persist((set, get) => ({
  document: starterCircuit(),
  selection: null,
  selectedIds: [],
  pendingPin: null,
  simulation: null,
  transient: null,
  analysisMode: 'dc',
  timeIndex: 0,
  transientDuration: 1,
  transientSteps: 240,
  showFlow: true,
  message: 'Workbench ready. Select a part, then press RUN DC or TRANSIENT.',
  past: [], future: [], dragSnapshot: null, clipboard: null, pasteCount: 0,
  addComponent: (kind, at) => {
    const component: CircuitComponent = {
      id: id(), kind, x: snap(at.x), y: snap(at.y), rotation: 0, value: freshValue[kind],
      ...(kind === 'switch' ? { closed: false } : {}),
      ...(kind === 'potentiometer' ? { wiper: .5 } : {}),
    };
    set(state => edit(state, {
      ...state.document, components: [...state.document.components, component],
    }, {
      selection: { type: 'component', id: component.id },
      selectedIds: [component.id], pendingPin: null,
    }));
  },
  beginDrag: () => set(state =>
    state.dragSnapshot ? {} : { dragSnapshot: state.document }),
  endDrag: () => set(state => {
    if (!state.dragSnapshot) return {};
    if (state.dragSnapshot === state.document) return { dragSnapshot: null };
    return {
      dragSnapshot: null, past: limitHistory([...state.past, state.dragSnapshot]),
      future: [],
    };
  }),
  moveComponent: (idToMove, at) => set(state => {
    const target = state.document.components.find(c => c.id === idToMove);
    if (!target) return {};
    const dx = snap(at.x) - target.x, dy = snap(at.y) - target.y;
    if (!dx && !dy) return {};
    const targets = new Set(state.selectedIds.includes(idToMove) ? state.selectedIds : [idToMove]);
    return edit(state, {
      ...state.document,
      components: state.document.components.map(c =>
        targets.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c),
    });
  }),
  moveFreeEnd: (wireId, side, at) => set(state => {
    const wire = state.document.wires.find(w => w.id === wireId);
    if (!wire || isTerminal(wire[side])) return {};
    const p = { x: snap(at.x), y: snap(at.y) };
    if ((wire[side] as Point).x === p.x && (wire[side] as Point).y === p.y) return {};
    return edit(state, {
      ...state.document,
      wires: state.document.wires.map(w => w.id === wireId
        ? { ...w, [side]: p } : w),
    });
  }),
  straightenWire: wireId => set(state => {
    const wire = state.document.wires.find(w => w.id === wireId);
    if (!wire || !wire.waypoints?.length) return {};
    return edit(state, {
      ...state.document,
      wires: state.document.wires.map(w => w.id === wireId ? { ...w, waypoints: [] } : w),
    });
  }),
  rotateComponent: idToRotate => set(state => {
    if (!state.document.components.some(c => c.id === idToRotate)) return {};
    return edit(state, {
      ...state.document,
      components: state.document.components.map(c => c.id === idToRotate
        ? { ...c, rotation: ((c.rotation + 90) % 360) as Rotation } : c),
    });
  }),
  setComponentValue: (idToEdit, value) => {
    if (!Number.isFinite(value)) return;
    set(state => {
      const target = state.document.components.find(c => c.id === idToEdit);
      if (!target || target.value === value) return {};
      return edit(state, {
        ...state.document,
        components: state.document.components.map(c => c.id === idToEdit
          ? { ...c, value } : c),
      });
    });
  },
  toggleSwitch: idToToggle => set(state => {
    const c = state.document.components.find(c => c.id === idToToggle);
    if (!c || c.kind !== 'switch') return {};
    return edit(state, {
      ...state.document,
      components: state.document.components.map(c => c.id === idToToggle
        ? { ...c, closed: !c.closed } : c),
    });
  }),
  setPotWiper: (idToEdit, value) => set(state => {
    const c = state.document.components.find(c => c.id === idToEdit);
    const wiper = Math.max(.001, Math.min(.999, value));
    if (!c || c.kind !== 'potentiometer' || c.wiper === wiper) return {};
    return edit(state, {
      ...state.document,
      components: state.document.components.map(c => c.id === idToEdit
        ? { ...c, wiper } : c),
    });
  }),
  rename: name => set(state => ({
    document: { ...state.document, name: name.slice(0, 90) },
  })),
  select: (selection, additive = false) => set(state => {
    if (selection?.type !== 'component') {
      return { selection, selectedIds: [] };
    }
    if (!additive) {
      return { selection, selectedIds: [selection.id] };
    }
    const selectedIds = state.selectedIds.includes(selection.id)
      ? state.selectedIds.filter(id => id !== selection.id)
      : [...state.selectedIds, selection.id];
    return {
      selection: selectedIds.length ? { type: 'component', id: selectedIds[selectedIds.length - 1] } : null,
      selectedIds,
    };
  }),
  selectAll: () => set(state => {
    const selectedIds = state.document.components.map(c => c.id);
    return {
      selectedIds,
      selection: selectedIds.length ? { type: 'component', id: selectedIds[selectedIds.length - 1] } : null,
      message: selectedIds.length + ' components selected (Ctrl/Cmd+C to copy).',
    };
  }),
  copySelection: () => set(state => {
    const copied = clipboardOf(state.document, state.selectedIds);
    return copied
      ? { clipboard: copied, pasteCount: 0, message: copied.components.length + ' parts copied.' }
      : { message: 'Select one or more components before copying.' };
  }),
  pasteClipboard: () => set(state => {
    if (!state.clipboard) return { message: 'Nothing copied yet. Select and copy components first.' };
    const shift = 48 * (state.pasteCount + 1);
    const ids = new Map(state.clipboard.components.map(c => [c.id, id()]));
    const components = state.clipboard.components.map(c => ({
      ...c, id: ids.get(c.id)!, x: c.x + shift, y: c.y + shift,
    }));
    const shiftEndpoint = (point: WireEndpoint): WireEndpoint => isTerminal(point)
      ? { componentId: ids.get(point.componentId)!, pin: point.pin }
      : { x: point.x + shift, y: point.y + shift };
    const wires: Wire[] = state.clipboard.wires.map(w => ({
      id: id(), from: shiftEndpoint(w.from), to: shiftEndpoint(w.to),
      waypoints: w.waypoints?.map(p => ({ x: p.x + shift, y: p.y + shift })),
    }));
    return edit(state, {
      ...state.document,
      components: [...state.document.components, ...components],
      wires: [...state.document.wires, ...wires],
    }, {
      selectedIds: components.map(c => c.id),
      selection: { type: 'component', id: components[components.length - 1].id },
      pasteCount: state.pasteCount + 1,
      message: 'Pasted ' + components.length + ' components with internal wires.',
    });
  }),
  duplicateSelection: () => {
    get().copySelection();
    get().pasteClipboard();
  },
  undo: () => set(state => {
    if (!state.past.length) return {};
    return {
      document: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.document, ...state.future].slice(0, 80),
      selection: null, selectedIds: [], pendingPin: null,
      dragSnapshot: null, ...invalidated, message: 'Undo · previous circuit restored.',
    };
  }),
  redo: () => set(state => {
    if (!state.future.length) return {};
    return {
      document: state.future[0],
      future: state.future.slice(1),
      past: limitHistory([...state.past, state.document]),
      selection: null, selectedIds: [], pendingPin: null,
      dragSnapshot: null, ...invalidated, message: 'Redo · next circuit restored.',
    };
  }),
  setFlowEnabled: enabled => set({ showFlow: enabled }),
  beginWire: endpoint => set({
    pendingPin: endpoint, selection: null, selectedIds: [],
    message: 'Wire drawing started. Click free space to leave a tip, or a terminal to connect. ESC finishes.',
  }),
  startOrFinishWire: endpoint => {
    const previous = get().pendingPin;
    if (!previous) { get().beginWire(endpoint); return; }
    if (equalEndpoint(previous, endpoint)) {
      set({ pendingPin: null, message: 'Wire drawing completed.' }); return;
    }
    const doc = get().document;
    for (const e of [previous, endpoint]) {
      if (!isTerminal(e)) continue;
      const c = doc.components.find(part => part.id === e.componentId);
      if (!c || (c.kind === 'ground' ? e.pin !== 'g'
        : c.kind === 'potentiometer' ? !['a', 'b', 'w'].includes(e.pin)
          : !['a', 'b'].includes(e.pin))) {
        set({ pendingPin: null, message: 'Invalid terminal selected.' }); return;
      }
    }
    const exists = doc.wires.some(w =>
      (equalEndpoint(w.from, previous) && equalEndpoint(w.to, endpoint)) ||
      (equalEndpoint(w.to, previous) && equalEndpoint(w.from, endpoint)));
    if (exists) {
      set({ pendingPin: null, message: 'Those wire endpoints are already connected.' }); return;
    }
    set(state => edit(state, {
      ...state.document,
      wires: [...state.document.wires, { id: id(), from: previous, to: endpoint }],
    }, {
      selection: null, selectedIds: [],
      pendingPin: isTerminal(endpoint) ? null : endpoint,
      message: isTerminal(endpoint) ? 'Wire connected.' : 'Free tip created · ESC to stop.',
    }));
  },
  cancelWire: () => set({ pendingPin: null, message: 'Wire drawing finished.' }),
  removeSelection: () => set(state => {
    const targets = new Set(state.selectedIds);
    if (state.selection?.type === 'component') targets.add(state.selection.id);
    const wire = state.selection?.type === 'wire' ? state.selection.id : null;
    if (!targets.size && !wire) return {};
    return edit(state, {
      ...state.document,
      components: state.document.components.filter(c => !targets.has(c.id)),
      wires: state.document.wires.filter(w =>
        w.id !== wire &&
        !(isTerminal(w.from) && targets.has(w.from.componentId)) &&
        !(isTerminal(w.to) && targets.has(w.to.componentId))),
    }, {
      selection: null, selectedIds: [], pendingPin: null,
    });
  }),
  newCircuit: () => set(state => edit(state, emptyDocument(), {
    selection: null, selectedIds: [], pendingPin: null,
    message: 'New circuit. Right-click the grid to place components.',
  })),
  loadDocument: input => {
    if (!isCircuitDocument(input)) throw new Error('Invalid or unsupported circuit JSON (expected schema v1).');
    set(state => edit(state, input, {
      selection: null, selectedIds: [], pendingPin: null,
      message: 'Circuit loaded. Run DC or transient analysis.',
    }));
  },
  simulate: () => {
    try {
      const simulation = solveDC(get().document);
      set({
        simulation, transient: null, analysisMode: 'dc', timeIndex: 0,
        message: 'DC analysis complete · ' + simulation.nodeCount + ' nodes.',
      });
    } catch (error) {
      set({
        simulation: null, transient: null,
        message: error instanceof Error ? error.message : 'DC simulation failed.',
      });
    }
  },
  simulateTransient: () => {
    try {
      const { transientDuration, transientSteps } = get();
      const transient = runTransient(get().document, {
        duration: transientDuration, steps: transientSteps,
      });
      set({
        transient, simulation: transient.frames[0], analysisMode: 'transient',
        timeIndex: 0, message: 'Transient ready · scrub or press PLAY.',
      });
    } catch (error) {
      set({
        simulation: null, transient: null,
        message: error instanceof Error ? error.message : 'Transient simulation failed.',
      });
    }
  },
  setTransientDuration: duration => {
    if (!Number.isFinite(duration)) return;
    set({ transientDuration: Math.min(30, Math.max(.001, duration)), ...invalidated,
      message: 'Time window changed. Run TRANSIENT to recalculate.' });
  },
  setTransientSteps: requested => {
    if (!Number.isFinite(requested)) return;
    set({
      transientSteps: Math.round(Math.min(500, Math.max(24, requested))),
      ...invalidated,
      message: 'Time resolution changed. Run TRANSIENT to recalculate.',
    });
  },
  setTimeIndex: requested => set(state => {
    if (!state.transient) return {};
    const index = Math.round(Math.max(0, Math.min(state.transient.steps, requested)));
    return { timeIndex: index, simulation: state.transient.frames[index] };
  }),
  save: () => set({ message: 'Autosaved locally. EXPORT to make a JSON backup.' }),
}), {
  name: 'pixel-circuits-v01',
  partialize: state => ({
    document: state.document,
    transientDuration: state.transientDuration,
    transientSteps: state.transientSteps,
    showFlow: state.showFlow,
  }),
}));
