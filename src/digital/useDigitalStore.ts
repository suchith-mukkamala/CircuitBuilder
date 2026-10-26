import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DigitalComponent, DigitalDocument, DigitalEndpoint, DigitalKind, DigitalPoint,
  DigitalSelection, DigitalWire, digitalId, digitalSnap, initialDigitalCircuit,
  isDigitalDocument, isDigitalTerminal,
} from './types';

type Clip = { components: DigitalComponent[]; wires: DigitalWire[] };
type Side = 'from' | 'to';
export type DigitalStore = {
  document: DigitalDocument;
  selection: DigitalSelection;
  selectedIds: string[];
  pending: DigitalEndpoint | null;
  past: DigitalDocument[];
  future: DigitalDocument[];
  dragOrigin: DigitalDocument | null;
  clipboard: Clip | null;
  pasteCount: number;
  message: string;
  add: (kind: DigitalKind, at: DigitalPoint) => void;
  move: (id: string, at: DigitalPoint) => void;
  moveEnd: (wireId: string, side: Side, to: DigitalPoint) => void;
  rotate: (id: string) => void;
  toggleInput: (id: string) => void;
  setName: (id: string, name: string) => void;
  renameDocument: (name: string) => void;
  select: (selection: DigitalSelection, additive?: boolean) => void;
  selectAll: () => void;
  remove: () => void;
  startWire: (endpoint: DigitalEndpoint) => void;
  finishWire: (endpoint: DigitalEndpoint) => void;
  cancelWire: () => void;
  straighten: (id: string) => void;
  dragStart: () => void;
  dragEnd: () => void;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  newCircuit: () => void;
  load: (input: unknown) => void;
};
const limit = (h: DigitalDocument[]) => h.slice(-80);
const patch = (
  state: DigitalStore, document: DigitalDocument,
  extras: Partial<DigitalStore> = {},
): Partial<DigitalStore> => ({
  document,
  ...(state.dragOrigin ? {} : { past: limit([...state.past, state.document]), future: [] }),
  ...extras,
});
const same = (a: DigitalEndpoint, b: DigitalEndpoint) =>
  isDigitalTerminal(a) && isDigitalTerminal(b)
    ? a.componentId === b.componentId && a.pin === b.pin
    : !isDigitalTerminal(a) && !isDigitalTerminal(b) && a.x === b.x && a.y === b.y;
const ownWire = (w: DigitalWire, ids: Set<string>) =>
  (!isDigitalTerminal(w.from) || ids.has(w.from.componentId)) &&
  (!isDigitalTerminal(w.to) || ids.has(w.to.componentId)) &&
  ((isDigitalTerminal(w.from) && ids.has(w.from.componentId)) ||
   (isDigitalTerminal(w.to) && ids.has(w.to.componentId)));

export const useDigitalStore = create<DigitalStore>()(persist((set, get) => ({
  document: initialDigitalCircuit(),
  selection: null, selectedIds: [], pending: null,
  past: [], future: [], dragOrigin: null,
  clipboard: null, pasteCount: 0,
  message: 'Signal Lab ready · flip input switches to update the outputs.',
  add: (kind, at) => set(state => {
    const c: DigitalComponent = {
      id: digitalId(), kind, x: digitalSnap(at.x), y: digitalSnap(at.y), rotation: 0,
      ...(kind === 'input' ? { bit: 0 as const } : {}),
    };
    return patch(state, {
      ...state.document, components: [...state.document.components, c],
    }, {
      selection: { type: 'component', id: c.id }, selectedIds: [c.id], pending: null,
      message: kind.toUpperCase() + ' placed. Click a pin to wire it.',
    });
  }),
  move: (id, at) => set(state => {
    const part = state.document.components.find(c => c.id === id);
    if (!part) return {};
    const dx = digitalSnap(at.x) - part.x, dy = digitalSnap(at.y) - part.y;
    if (!dx && !dy) return {};
    const ids = new Set(state.selectedIds.includes(id) ? state.selectedIds : [id]);
    return patch(state, {
      ...state.document, components: state.document.components.map(c =>
        ids.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c),
    });
  }),
  moveEnd: (id, side, at) => set(state => {
    const wire = state.document.wires.find(w => w.id === id);
    if (!wire || isDigitalTerminal(wire[side])) return {};
    const point = { x: digitalSnap(at.x), y: digitalSnap(at.y) };
    const old = wire[side];
    if (!isDigitalTerminal(old) && old.x === point.x && old.y === point.y) return {};
    return patch(state, {
      ...state.document, wires: state.document.wires.map(w =>
        w.id === id ? { ...w, [side]: point } : w),
    });
  }),
  rotate: id => set(state => {
    if (!state.document.components.some(c => c.id === id)) return {};
    return patch(state, {
      ...state.document, components: state.document.components.map(c =>
        c.id === id ? { ...c, rotation: ((c.rotation + 90) % 360) as DigitalComponent['rotation'] } : c),
    });
  }),
  toggleInput: id => set(state => {
    const c = state.document.components.find(c => c.id === id && c.kind === 'input');
    if (!c) return {};
    return patch(state, {
      ...state.document, components: state.document.components.map(part =>
        part.id === id ? { ...part, bit: part.bit === 1 ? 0 : 1 } : part),
    }, { message: (c.name ?? 'Input') + ' switched to ' + (c.bit === 1 ? 'LOW' : 'HIGH') + '.' });
  }),
  setName: (id, name) => set(state => {
    const c = state.document.components.find(c => c.id === id);
    if (!c) return {};
    return patch(state, {
      ...state.document, components: state.document.components.map(part =>
        part.id === id ? { ...part, name: name.slice(0, 28) } : part),
    });
  }),
  renameDocument: name => set(state => ({
    document: { ...state.document, name: name.slice(0, 90) },
  })),
  select: (selection, additive = false) => set(state => {
    if (selection?.type !== 'component') return { selection, selectedIds: [] };
    if (!additive) return { selection, selectedIds: [selection.id] };
    const ids = state.selectedIds.includes(selection.id)
      ? state.selectedIds.filter(id => id !== selection.id)
      : [...state.selectedIds, selection.id];
    return { selectedIds: ids,
      selection: ids.length ? { type: 'component', id: ids[ids.length - 1] } : null };
  }),
  selectAll: () => set(state => {
    const ids = state.document.components.map(c => c.id);
    return { selectedIds: ids,
      selection: ids.length ? { type: 'component', id: ids[ids.length - 1] } : null };
  }),
  remove: () => set(state => {
    const ids = new Set(state.selectedIds);
    if (state.selection?.type === 'component') ids.add(state.selection.id);
    const wireId = state.selection?.type === 'wire' ? state.selection.id : null;
    if (!ids.size && !wireId) return {};
    return patch(state, {
      ...state.document,
      components: state.document.components.filter(c => !ids.has(c.id)),
      wires: state.document.wires.filter(w =>
        w.id !== wireId &&
        !(isDigitalTerminal(w.from) && ids.has(w.from.componentId)) &&
        !(isDigitalTerminal(w.to) && ids.has(w.to.componentId))),
    }, { selection: null, selectedIds: [], pending: null });
  }),
  startWire: endpoint => set({ pending: endpoint, selection: null, selectedIds: [],
    message: 'Click another terminal or free space to finish the wire. ESC cancels.' }),
  finishWire: endpoint => {
    const previous = get().pending;
    if (!previous) { get().startWire(endpoint); return; }
    if (same(previous, endpoint)) {
      set({ pending: null, message: 'Wire drawing stopped.' }); return;
    }
    const doc = get().document;
    const valid = (e: DigitalEndpoint) =>
      !isDigitalTerminal(e) || doc.components.some(c =>
        c.id === e.componentId && (c.kind === 'input' ? e.pin === 'out'
          : c.kind === 'led' ? e.pin === 'in'
            : c.kind === 'not' || c.kind === 'buffer' ? ['a', 'out'].includes(e.pin)
              : ['a', 'b', 'out'].includes(e.pin)));
    if (!valid(previous) || !valid(endpoint)) {
      set({ pending: null, message: 'Cannot connect to a missing pin.' }); return;
    }
    if (doc.wires.some(w => same(w.from, previous) && same(w.to, endpoint) ||
      same(w.to, previous) && same(w.from, endpoint))) {
      set({ pending: null, message: 'Those endpoints are already connected.' }); return;
    }
    set(state => patch(state, {
      ...state.document,
      wires: [...state.document.wires, { id: digitalId(), from: previous, to: endpoint }],
    }, { selection: null, selectedIds: [], pending: isDigitalTerminal(endpoint) ? null : endpoint,
      message: isDigitalTerminal(endpoint) ? 'Signal wire connected.' : 'Free signal tip created · ESC to stop.' }));
  },
  cancelWire: () => set({ pending: null, message: 'Wire drawing finished.' }),
  straighten: id => set(state => {
    const wire = state.document.wires.find(w => w.id === id);
    if (!wire || !wire.waypoints?.length) return {};
    return patch(state, {
      ...state.document, wires: state.document.wires.map(w =>
        w.id === id ? { ...w, waypoints: [] } : w),
    });
  }),
  dragStart: () => set(state => state.dragOrigin ? {} : { dragOrigin: state.document }),
  dragEnd: () => set(state => {
    if (!state.dragOrigin) return {};
    if (state.dragOrigin === state.document) return { dragOrigin: null };
    return { dragOrigin: null, past: limit([...state.past, state.dragOrigin]), future: [] };
  }),
  undo: () => set(state => {
    if (!state.past.length) return {};
    return {
      document: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.document, ...state.future].slice(0, 80),
      selection: null, selectedIds: [], pending: null,
      dragOrigin: null, message: 'Undo · previous digital schematic restored.',
    };
  }),
  redo: () => set(state => {
    if (!state.future.length) return {};
    return {
      document: state.future[0], future: state.future.slice(1),
      past: limit([...state.past, state.document]),
      selection: null, selectedIds: [], pending: null,
      dragOrigin: null, message: 'Redo · next schematic restored.',
    };
  }),
  copy: () => set(state => {
    const ids = new Set(state.selectedIds);
    const parts = state.document.components.filter(c => ids.has(c.id));
    if (!parts.length) return { message: 'Select components before copying.' };
    return {
      clipboard: { components: parts.map(c => ({ ...c })),
        wires: state.document.wires.filter(w => ownWire(w, ids)).map(w => ({
          ...w, from: { ...w.from }, to: { ...w.to },
          waypoints: w.waypoints?.map(p => ({ ...p })),
        })) },
      pasteCount: 0,
      message: parts.length + ' digital components copied.',
    };
  }),
  paste: () => set(state => {
    if (!state.clipboard) return { message: 'Copy one or more parts first.' };
    const offset = 48 * (state.pasteCount + 1);
    const ids = new Map(state.clipboard.components.map(c => [c.id, digitalId()]));
    const comps = state.clipboard.components.map(c =>
      ({ ...c, id: ids.get(c.id)!, x: c.x + offset, y: c.y + offset }));
    const translate = (endpoint: DigitalEndpoint): DigitalEndpoint =>
      isDigitalTerminal(endpoint)
        ? { componentId: ids.get(endpoint.componentId)!, pin: endpoint.pin }
        : { x: endpoint.x + offset, y: endpoint.y + offset };
    const wires = state.clipboard.wires.map(w => ({
      id: digitalId(), from: translate(w.from), to: translate(w.to),
      waypoints: w.waypoints?.map(p => ({ x: p.x + offset, y: p.y + offset })),
    }));
    return patch(state, {
      ...state.document, components: [...state.document.components, ...comps],
      wires: [...state.document.wires, ...wires],
    }, {
      selectedIds: comps.map(c => c.id),
      selection: { type: 'component', id: comps[comps.length - 1].id },
      pasteCount: state.pasteCount + 1,
      message: comps.length + ' components pasted.',
    });
  }),
  duplicate: () => { get().copy(); get().paste(); },
  newCircuit: () => set(state => patch(state, {
    version: 1, lab: 'signal', name: 'Untitled signal circuit', components: [], wires: [],
  }, { selection: null, selectedIds: [], pending: null, message: 'Empty Signal Lab schematic created.' })),
  load: input => {
    if (!isDigitalDocument(input)) {
      throw new Error('Not a Signal Lab JSON schematic (expected lab:"signal", version:1).');
    }
    set(state => patch(state, input, {
      selection: null, selectedIds: [], pending: null, message: 'Signal schematic loaded.',
    }));
  },
}), {
  name: 'circuitbuilder-signal-v01',
  partialize: state => ({ document: state.document }),
}));
