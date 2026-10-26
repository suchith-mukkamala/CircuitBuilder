import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { starterCircuit } from '../circuit/sample';
import { CircuitDocument, CircuitComponent, ComponentKind, Selection, Rotation, Point, Terminal, DCResult, id, snap, terminalKey, isCircuitDocument } from '../circuit/types';
import { solveDC } from '../simulation/dc';

type CircuitStore = {
  document: CircuitDocument;
  selection: Selection;
  pendingPin: Terminal | null;
  simulation: DCResult | null;
  message: string;
  addComponent: (kind: ComponentKind, at: Point) => void;
  moveComponent: (id: string, at: Point) => void;
  rotateComponent: (id: string) => void;
  setComponentValue: (id: string, value: number) => void;
  rename: (name: string) => void;
  select: (selection: Selection) => void;
  startOrFinishWire: (pin: Terminal) => void;
  cancelWire: () => void;
  removeSelection: () => void;
  newCircuit: () => void;
  loadDocument: (doc: unknown) => void;
  simulate: () => void;
  save: () => void;
};

const freshValue: Record<ComponentKind, number> = {
  resistor: 1000, voltage_source: 5, ground: 0,
};
const invalidated = { simulation: null, message: 'Circuit updated. Run simulation for new results.' };
const emptyDocument = (): CircuitDocument => ({
  version: 1, name: 'Untitled circuit', components: [], wires: [],
});

export const useCircuitStore = create<CircuitStore>()(persist((set, get) => ({
  document: starterCircuit(),
  selection: null,
  pendingPin: null,
  simulation: null,
  message: 'Example loaded. Click RUN DC to simulate a 10 V voltage divider.',
  addComponent: (kind, at) => {
    const component: CircuitComponent = {
      id: id(), kind, x: snap(at.x), y: snap(at.y), rotation: 0, value: freshValue[kind],
    };
    set(state => ({
      document: { ...state.document, components: [...state.document.components, component] },
      selection: { type: 'component', id: component.id },
      pendingPin: null, ...invalidated,
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
    document: { ...state.document, components: state.document.components.map(c => c.id === idToRotate
      ? { ...c, rotation: ((c.rotation + 90) % 360) as Rotation } : c) },
    ...invalidated,
  })),
  setComponentValue: (idToEdit, value) => {
    if (!Number.isFinite(value)) return;
    set(state => ({
      document: { ...state.document, components: state.document.components.map(c => c.id === idToEdit
        ? { ...c, value } : c) }, ...invalidated,
    }));
  },
  rename: name => set(state => ({ document: { ...state.document, name: name.slice(0, 90) } })),
  select: selection => set({ selection }),
  startOrFinishWire: pin => {
    const previous = get().pendingPin;
    if (!previous) { set({ pendingPin: pin, selection: null, message: 'Select a second terminal to complete the wire. ESC cancels.' }); return; }
    if (terminalKey(previous) === terminalKey(pin)) { set({ pendingPin: null, message: 'Wire cancelled.' }); return; }
    const doc = get().document;
    const a = doc.components.find(c => c.id === pin.componentId);
    if (!a || !(a.kind === 'ground' ? pin.pin === 'g' : ['a', 'b'].includes(pin.pin))) {
      set({ pendingPin: null }); return;
    }
    const exists = doc.wires.some(w =>
      (terminalKey(w.from) === terminalKey(previous) && terminalKey(w.to) === terminalKey(pin)) ||
      (terminalKey(w.to) === terminalKey(previous) && terminalKey(w.from) === terminalKey(pin)));
    if (exists) { set({ pendingPin: null, message: 'Those terminals are already connected.' }); return; }
    set(state => ({
      document: { ...state.document, wires: [...state.document.wires, {
        id: id(), from: previous, to: pin,
      }] },
      selection: null, pendingPin: null, ...invalidated,
    }));
  },
  cancelWire: () => set({ pendingPin: null, message: 'Wire cancelled.' }),
  removeSelection: () => set(state => {
    if (!state.selection) return state;
    if (state.selection.type === 'wire') return {
      document: { ...state.document, wires: state.document.wires.filter(w => w.id !== state.selection?.id) },
      selection: null, pendingPin: null, ...invalidated,
    };
    return {
      document: {
        ...state.document,
        components: state.document.components.filter(c => c.id !== state.selection?.id),
        wires: state.document.wires.filter(w =>
          w.from.componentId !== state.selection?.id && w.to.componentId !== state.selection?.id),
      },
      selection: null, pendingPin: null, ...invalidated,
    };
  }),
  newCircuit: () => set({
    document: emptyDocument(), selection: null, pendingPin: null, simulation: null,
    message: 'New circuit. Choose a component from the palette.',
  }),
  loadDocument: input => {
    if (!isCircuitDocument(input)) throw new Error('Invalid or unsupported circuit file (expected v1 JSON).');
    set({
      document: input, selection: null, pendingPin: null, simulation: null,
      message: 'Circuit loaded successfully. Run DC to update results.',
    });
  },
  simulate: () => {
    try {
      const simulation = solveDC(get().document);
      set({ simulation, message: 'DC analysis complete · ' + simulation.nodeCount + ' electrical nodes.' });
    } catch (error) {
      set({ simulation: null, message: error instanceof Error ? error.message : 'Simulation failed.' });
    }
  },
  save: () => {
    set({ message: 'Saved to this browser automatically. Use EXPORT to save a JSON file.' });
  },
}), {
  name: 'pixel-circuits-v01',
  partialize: state => ({ document: state.document }),
}));
