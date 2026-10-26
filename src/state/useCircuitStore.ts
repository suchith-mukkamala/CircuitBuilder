import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { starterCircuit } from '../circuit/sample';
import {
  CircuitDocument, CircuitComponent, ComponentKind, Selection, Rotation, Point,
  WireEndpoint, DCResult, TransientResult, id, snap, isTerminal, isCircuitDocument,
} from '../circuit/types';
import { solveDC } from '../simulation/dc';
import { runTransient } from '../simulation/transient';

type CircuitStore = {
  document: CircuitDocument;
  selection: Selection;
  pendingPin: WireEndpoint | null;
  simulation: DCResult | null;
  transient: TransientResult | null;
  analysisMode: 'dc' | 'transient';
  transientDuration: number;
  timeIndex: number;
  message: string;
  addComponent: (kind: ComponentKind, at: Point) => void;
  moveComponent: (id: string, at: Point) => void;
  rotateComponent: (id: string) => void;
  setComponentValue: (id: string, value: number) => void;
  toggleSwitch: (id: string) => void;
  setPotWiper: (id: string, value: number) => void;
  rename: (name: string) => void;
  select: (selection: Selection) => void;
  startOrFinishWire: (endpoint: WireEndpoint) => void;
  beginWire: (endpoint: WireEndpoint) => void;
  cancelWire: () => void;
  removeSelection: () => void;
  newCircuit: () => void;
  loadDocument: (doc: unknown) => void;
  simulate: () => void;
  simulateTransient: () => void;
  setTransientDuration: (seconds: number) => void;
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
const equalEndpoint = (a: WireEndpoint, b: WireEndpoint) =>
  isTerminal(a) && isTerminal(b)
    ? a.componentId === b.componentId && a.pin === b.pin
    : !isTerminal(a) && !isTerminal(b) && a.x === b.x && a.y === b.y;

export const useCircuitStore = create<CircuitStore>()(persist((set, get) => ({
  document: starterCircuit(),
  selection: null,
  pendingPin: null,
  simulation: null,
  transient: null,
  analysisMode: 'dc',
  timeIndex: 0,
  transientDuration: 1,
  message: 'Ready. Try the RC and RL labs or draw a free-ended wire.',
  addComponent: (kind, at) => {
    const component: CircuitComponent = {
      id: id(), kind, x: snap(at.x), y: snap(at.y), rotation: 0,
      value: freshValue[kind],
      ...(kind === 'switch' ? { closed: false } : {}),
      ...(kind === 'potentiometer' ? { wiper: .5 } : {}),
    };
    set(state => ({
      document: { ...state.document, components: [...state.document.components, component] },
      selection: { type: 'component', id: component.id },
      ...invalidated,
    }));
  },
  moveComponent: (idToMove, at) => set(state => ({
    document: {
      ...state.document,
      components: state.document.components.map(c => c.id === idToMove
        ? { ...c, x: snap(at.x), y: snap(at.y) } : c),
    }, ...invalidated,
  })),
  rotateComponent: idToRotate => set(state => ({
    document: {
      ...state.document,
      components: state.document.components.map(c => c.id === idToRotate
        ? { ...c, rotation: ((c.rotation + 90) % 360) as Rotation } : c),
    }, ...invalidated,
  })),
  setComponentValue: (idToEdit, value) => {
    if (!Number.isFinite(value)) return;
    set(state => ({
      document: {
        ...state.document,
        components: state.document.components.map(c => c.id === idToEdit
          ? { ...c, value } : c),
      }, ...invalidated,
    }));
  },
  toggleSwitch: idToToggle => set(state => ({
    document: {
      ...state.document,
      components: state.document.components.map(c =>
        c.id === idToToggle && c.kind === 'switch' ? { ...c, closed: !c.closed } : c),
    }, ...invalidated,
  })),
  setPotWiper: (idToEdit, value) => set(state => ({
    document: {
      ...state.document,
      components: state.document.components.map(c =>
        c.id === idToEdit && c.kind === 'potentiometer'
          ? { ...c, wiper: Math.max(.001, Math.min(.999, value)) } : c),
    }, ...invalidated,
  })),
  rename: name => set(state => ({ document: { ...state.document, name: name.slice(0, 90) } })),
  select: selection => set({ selection }),
  beginWire: endpoint => set({
    pendingPin: endpoint, selection: null,
    message: 'Wire drawing started. Click empty grid to leave a stub or a terminal to connect. ESC finishes.',
  }),
  startOrFinishWire: endpoint => {
    const previous = get().pendingPin;
    if (!previous) {
      get().beginWire(endpoint);
      return;
    }
    if (equalEndpoint(previous, endpoint)) {
      set({ pendingPin: null, message: 'Wire drawing completed.' });
      return;
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
      set({ pendingPin: null, message: 'Those wire endpoints are already connected.' });
      return;
    }
    set(state => ({
      document: {
        ...state.document,
        wires: [...state.document.wires, { id: id(), from: previous, to: endpoint }],
      },
      selection: null,
      // Continue an unfinished trace from the newly placed free end.
      pendingPin: isTerminal(endpoint) ? null : endpoint,
      ...invalidated,
      message: isTerminal(endpoint)
        ? 'Wire connected. Run analysis to update results.'
        : 'Free endpoint created. Continue drawing, or press ESC to finish.',
    }));
  },
  cancelWire: () => set({ pendingPin: null, message: 'Wire drawing finished.' }),
  removeSelection: () => set(state => {
    if (!state.selection) return state;
    if (state.selection.type === 'wire') return {
      document: { ...state.document, wires: state.document.wires.filter(w =>
        w.id !== state.selection?.id) },
      selection: null, pendingPin: null, ...invalidated,
    };
    return {
      document: {
        ...state.document,
        components: state.document.components.filter(c => c.id !== state.selection?.id),
        wires: state.document.wires.filter(w =>
          !(isTerminal(w.from) && w.from.componentId === state.selection?.id) &&
          !(isTerminal(w.to) && w.to.componentId === state.selection?.id)),
      },
      selection: null, pendingPin: null, ...invalidated,
    };
  }),
  newCircuit: () => set({
    document: emptyDocument(), selection: null, pendingPin: null, ...invalidated,
    message: 'New circuit. Right-click the grid or choose a component.',
  }),
  loadDocument: input => {
    if (!isCircuitDocument(input)) {
      throw new Error('Invalid or unsupported circuit JSON (expected schema v1).');
    }
    set({
      document: input, selection: null, pendingPin: null, ...invalidated,
      message: 'Circuit loaded. Ready for DC or transient analysis.',
    });
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
      const transient = runTransient(get().document, { duration: get().transientDuration, steps: 240 });
      set({
        transient, simulation: transient.frames[0], analysisMode: 'transient', timeIndex: 0,
        message: 'Transient ready · drag the time slider or press PLAY.',
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
    set({
      transientDuration: Math.min(30, Math.max(.001, duration)),
      ...invalidated,
      message: 'Time window changed. Run TRANSIENT to recalculate.',
    });
  },
  setTimeIndex: requested => set(state => {
    if (!state.transient) return {};
    const index = Math.round(Math.max(0, Math.min(state.transient.steps, requested)));
    return { timeIndex: index, simulation: state.transient.frames[index] };
  }),
  save: () => set({ message: 'Saved locally in your browser. Use EXPORT for a JSON backup.' }),
}), {
  name: 'pixel-circuits-v01',
  partialize: state => ({
    document: state.document,
    transientDuration: state.transientDuration,
  }),
}));
