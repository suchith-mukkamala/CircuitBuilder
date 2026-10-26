import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DigitalComponent, DigitalDocument, DigitalEndpoint, DigitalKind, DigitalPoint,
  DigitalSelection, DigitalWire, DigitalBlock, LogicValue, digitalId, digitalSnap,
  initialDigitalCircuit, isDigitalDocument, isDigitalTerminal, pinsOf,
} from './types';
import { simulateLogic } from './engine';
import { applyInputVector, captureBlock, placeBlock, reviseBlockDefinition, updatedBlockCatalog } from './blocks';

type Clip = { components: DigitalComponent[]; wires: DigitalWire[] };
type Side = 'from' | 'to';
/** Navigation frame for a block editor. The original parent is not mutated
 * until SAVE BLOCK, so CANCEL can leave the circuit untouched. */
export type BlockEditFrame = {
  blockId: string;
  instanceId: string;
  name: string;
  document: DigitalDocument;
  past: DigitalDocument[];
  future: DigitalDocument[];
  selection: DigitalSelection;
  selectedIds: string[];
  probes: SignalProbe[];
  trace: SignalSample[];
  clipboard: Clip | null;
  pasteCount: number;
};

export type SignalProbe = { id: string; kind: 'terminal' | 'wire'; key: string; label: string };
export type SignalSample = {
  step: number;
  vector: string;
  terminals: Record<string, LogicValue>;
  wires: Record<string, LogicValue>;
};
const sample = (doc: DigitalDocument, step: number): SignalSample => {
  const result = simulateLogic(doc);
  return { step, vector: doc.components.filter(c => c.kind === 'input').map(c => c.bit ?? 0).join(''),
    terminals: result.terminalValues, wires: result.wireValues };
};
const samples = (previous: SignalSample[], doc: DigitalDocument) => {
  const nextStep = (previous.at(-1)?.step ?? -1) + 1;
  return [...previous, sample(doc, nextStep)].slice(-160);
};
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
  blockLibrary: DigitalBlock[];
  editStack: BlockEditFrame[];
  openBlock: (instanceId: string) => void;
  saveBlockEdit: () => void;
  cancelBlockEdit: () => void;
  probes: SignalProbe[];
  trace: SignalSample[];
  captureAsBlock: (name: string) => void;
  addSavedBlock: (id: string, at: DigitalPoint) => void;
  applyVector: (vector: string) => void;
  addProbe: (kind: SignalProbe['kind'], key: string, label: string) => void;
  removeProbe: (id: string) => void;
  clearTrace: () => void;
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
  ...(state.dragOrigin ? {} : { trace: [sample(document, 0)] }),
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

/** Exported separately so draft/committed persistence can be regression-tested
 * even when Node test runners do not provide localStorage. */
export function persistedDigitalState(state: Pick<DigitalStore, 'document' | 'editStack' | 'blockLibrary'>) {
  return {
    document: state.editStack[0]?.document ?? state.document,
    blockLibrary: state.blockLibrary,
  };
}

export const useDigitalStore = create<DigitalStore>()(persist((set, get) => ({
  document: initialDigitalCircuit(),
  selection: null, selectedIds: [], pending: null,
  past: [], future: [], dragOrigin: null,
  clipboard: null, pasteCount: 0,
  blockLibrary: [], editStack: [], probes: [], trace: [sample(initialDigitalCircuit(), 0)],
  message: 'Signal Lab ready · flip input switches to update the outputs.',
  openBlock: instanceId => {
    const state = get();
    const instance = state.document.components.find(c => c.id === instanceId);
    if (!instance || instance.kind !== 'block' || !instance.blockId) {
      throw new Error('Select a saved circuit block to open its internal schematic.');
    }
    const catalog = new Map(state.blockLibrary.map(def => [def.id, def]));
    for (const def of state.document.blocks ?? []) catalog.set(def.id, def);
    const definition = catalog.get(instance.blockId);
    if (!definition) throw new Error('The internal schematic for this block is missing.');
    if (state.editStack.some(f => f.blockId === definition.id)) {
      throw new Error('Recursive block editing is not supported.');
    }
    const working: DigitalDocument = {
      ...definition.circuit,
      blocks: [...catalog.values()],
    };
    if (!isDigitalDocument(working)) {
      throw new Error('The saved block definition is invalid. Its internal circuit cannot be opened.');
    }
    simulateLogic(working);
    const frame: BlockEditFrame = {
      blockId: definition.id, instanceId, name: definition.name,
      document: state.document, past: state.past, future: state.future,
      selection: state.selection, selectedIds: state.selectedIds,
      probes: state.probes, trace: state.trace,
      clipboard: state.clipboard, pasteCount: state.pasteCount,
    };
    set({
      document: working,
      editStack: [...state.editStack, frame],
      past: [], future: [], selection: null, selectedIds: [],
      pending: null, dragOrigin: null, clipboard: null, pasteCount: 0,
      probes: [], trace: [sample(working, 0)],
      message: 'Editing ' + definition.name + '. Save Block updates all instances; Cancel discards edits.',
    });
  },
  saveBlockEdit: () => {
    const state = get();
    const frame = state.editStack.at(-1);
    if (!frame) throw new Error('No open block to save.');
    const existing = (state.document.blocks ?? state.blockLibrary)
      .find(def => def.id === frame.blockId);
    if (!existing) throw new Error('The current block definition is missing.');
    const revised = reviseBlockDefinition(existing, state.document);
    const libraryById = new Map(state.blockLibrary.map(def => [def.id, def]));
    libraryById.set(revised.id, revised);
    const defs = [...libraryById.values()];
    const sync = (doc: DigitalDocument) => updatedBlockCatalog(doc, defs);
    const parent = sync(frame.document);
    // All placed instances keep the same external pin names; only the
    // internal gate logic and optional display labels change.
    simulateLogic(parent); // validation before touching persistent state
    const stack = state.editStack.slice(0, -1).map(f => ({
      ...f, document: sync(f.document),
      past: f.past.map(sync), future: f.future.map(sync),
    }));
    set({
      document: parent,
      blockLibrary: defs, editStack: stack,
      past: limit([...frame.past, frame.document]),
      future: [], selection: parent.components.some(c => c.id === frame.instanceId)
        ? { type: 'component', id: frame.instanceId } : frame.selection,
      selectedIds: parent.components.some(c => c.id === frame.instanceId)
        ? [frame.instanceId] : frame.selectedIds,
      pending: null, dragOrigin: null,
      probes: frame.probes, trace: [sample(parent, 0)],
      clipboard: frame.clipboard, pasteCount: frame.pasteCount,
      message: 'Saved ' + revised.name + '. All instances now use the updated internal circuit.',
    });
  },
  cancelBlockEdit: () => {
    const state = get();
    const frame = state.editStack.at(-1);
    if (!frame) return;
    set({
      document: frame.document,
      editStack: state.editStack.slice(0, -1),
      past: frame.past, future: frame.future,
      selection: frame.selection, selectedIds: frame.selectedIds,
      pending: null, dragOrigin: null, probes: frame.probes,
      trace: frame.trace, clipboard: frame.clipboard,
      pasteCount: frame.pasteCount,
      message: 'Closed ' + frame.name + ' without saving internal edits.',
    });
  },
  captureAsBlock: name => {
    const state = get();
    if (state.editStack.length) throw new Error(
      'Save or cancel the open block before capturing a new module.',
    );
    const { definition, condensed } = captureBlock(state.document, name);
    const known = new Map(state.blockLibrary.map(d => [d.id, d]));
    known.set(definition.id, definition);
    for (const dependency of state.document.blocks ?? []) known.set(dependency.id, dependency);
    set(current => patch(current, condensed, {
      blockLibrary: [...known.values()],
      selection: {type:'component',id:condensed.components.find(c=>c.kind==='block')!.id},
      selectedIds: [condensed.components.find(c=>c.kind==='block')!.id], pending:null,
      probes: [], message: 'Captured ' + definition.name + ' as a reusable circuit block.',
    }));
  },
  addSavedBlock: (id, at) => {
    const state = get();
    const placed = placeBlock(state.document, state.blockLibrary, id, at);
    const instance = placed.components[placed.components.length-1];
    set(current => patch(current, placed, {
      selection: {type:'component',id:instance.id}, selectedIds: [instance.id],
      message: 'Reusable block placed. Connect its named input and output pins.',
    }));
  },
  applyVector: vector => {
    const state = get();
    const next = applyInputVector(state.document, vector);
    set(current => patch(current, next, {
      trace: samples(current.trace, next),
      message: 'Applied input ' + vector + ' · outputs updated.',
    }));
  },
  addProbe: (kind,key,label) => set(state => {
    if (state.probes.some(p => p.kind === kind && p.key === key)) return {};
    if (state.probes.length >= 4) return {message:'Up to four signal probes can be graphed together.'};
    return {probes:[...state.probes,{id:digitalId(),kind,key,label}],
      message:'Probe attached to ' + label + '. Open WAVEFORM to inspect recorded logic events.'};
  }),
  removeProbe: id => set(state => ({probes:state.probes.filter(p=>p.id!==id)})),
  clearTrace: () => set(state => ({trace:[sample(state.document,0)],message:'Signal history reset.'})),
  add: (kind, at) => set(state => {
    if (kind === 'block') return { message: 'Insert a block from the saved block library.' };
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
    }, { trace: samples(state.trace, {
        ...state.document, components: state.document.components.map(part =>
          part.id === id ? { ...part, bit: part.bit === 1 ? 0 as const : 1 as const } : part),
      }), message: (c.name ?? 'Input') + ' switched to ' + (c.bit === 1 ? 'LOW' : 'HIGH') + '.' });
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
    // Use each component's *declared* pins, including custom module ports
    // (in0, in1, out0...). The old hard-coded gate pin set silently
    // rejected valid block connections during interactive wiring.
    const valid = (e: DigitalEndpoint) =>
      !isDigitalTerminal(e) || doc.components.some(c =>
        c.id === e.componentId && pinsOf(c).includes(e.pin));
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
    return { dragOrigin: null, past: limit([...state.past, state.dragOrigin]),
      future: [], trace:[sample(state.document,0)] };
  }),
  undo: () => set(state => {
    if (!state.past.length) return {};
    return {
      document: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.document, ...state.future].slice(0, 80),
      selection: null, selectedIds: [], pending: null,
      dragOrigin: null, trace:[sample(state.past[state.past.length-1],0)],
      message: 'Undo · previous digital schematic restored.',
    };
  }),
  redo: () => set(state => {
    if (!state.future.length) return {};
    return {
      document: state.future[0], future: state.future.slice(1),
      past: limit([...state.past, state.document]),
      selection: null, selectedIds: [], pending: null,
      dragOrigin: null, trace:[sample(state.future[0],0)],
      message: 'Redo · next schematic restored.',
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
  newCircuit: () => set(state => {
    if (state.editStack.length) return {
      message: 'Save or cancel the open block before creating a new schematic.',
    };
    return patch(state, {
      version: 1, lab: 'signal', name: 'Untitled signal circuit', components: [], wires: [],
    }, { selection: null, selectedIds: [], pending: null,
      message: 'Empty Signal Lab schematic created.' });
  }),
  load: input => {
    if (get().editStack.length) {
      throw new Error('Save or cancel the open block before loading another circuit.');
    }
    if (!isDigitalDocument(input)) {
      throw new Error('Not a Signal Lab JSON schematic (expected lab:"signal", version:1).');
    }
    // Validate the expanded hierarchy BEFORE saving it to browser storage.
    // This also detects recursive module definitions on imported files.
    simulateLogic(input);
    set(state => patch(state, input, {
      selection: null, selectedIds: [], pending: null, probes:[],
      blockLibrary: [...new Map([...state.blockLibrary, ...(input.blocks ?? [])]
        .map(d => [d.id, d])).values()],
      message: 'Signal schematic loaded.',
    }));
  },
}), {
  name: 'circuitbuilder-signal-v01',
  // An in-progress internal edit is a draft: reload restores the last
  // committed parent, never an orphaned copy of the module's internals.
  partialize: persistedDigitalState,
}));
