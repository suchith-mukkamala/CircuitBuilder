import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DigitalComponent, DigitalDocument, DigitalEndpoint, DigitalKind, DigitalPoint,
  DigitalSelection, DigitalWire, DigitalBus, DigitalBusEnd, BusGroup,
  DigitalBlock, LogicValue, digitalId, digitalSnap, legalNetName, busGroups,
  initialDigitalCircuit, isDigitalDocument, isDigitalTerminal, pinsOf, digitalKinds,
  DigitalRuntime, emptyDigitalRuntime, defaultRomWords,
} from './types';
import { simulateLogic } from './engine';
import { stepCircuit,transitionInputs,resetComputer } from './computerEngine';
import {cpuCoreDemo,programmableCpuDemo} from './computerSamples';
import {assembleCasm,DEFAULT_CASM_SOURCE} from './casm';
import {digitalBusPath,digitalWirePath,endpointPoint} from './network';
import { applyInputVector, captureBlock, placeBlock, reviseBlockDefinition, updatedBlockCatalog } from './blocks';

type Clip = {components:DigitalComponent[];wires:DigitalWire[];buses?:DigitalBus[]};
export type DigitalWorkspace = 'signal' | 'computer';
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
  runtime: DigitalRuntime;
};

export type SignalProbe = { id: string; kind: 'terminal' | 'wire'; key: string; label: string };
export type SignalSample = {
  step: number;
  vector: string;
  terminals: Record<string, LogicValue>;
  wires: Record<string, LogicValue>;
};
const sample = (doc: DigitalDocument, step: number, runtime:DigitalRuntime=emptyDigitalRuntime()): SignalSample => {
  const result = simulateLogic(doc,runtime);
  return { step, vector: doc.components.filter(c => c.kind === 'input').map(c => c.bit ?? 0).join(''),
    terminals: result.terminalValues, wires: result.wireValues };
};
const samples = (previous: SignalSample[],doc:DigitalDocument,runtime:DigitalRuntime=emptyDigitalRuntime()) => {
  const nextStep=(previous.at(-1)?.step??-1)+1;
  return [...previous,sample(doc,nextStep,runtime)].slice(-160);
};
export type DigitalStore = {
  document: DigitalDocument;
  /** Separate, locally saved editor projects for each laboratory. */
  activeWorkspace: DigitalWorkspace;
  signalDocument: DigitalDocument;
  computerDocument: DigitalDocument;
  switchWorkspace: (destination:DigitalWorkspace) => boolean;
  selection: DigitalSelection;
  selectedIds: string[];
  pending: DigitalEndpoint | null;
  pendingBus: BusGroup | null;
  focusTarget: {id:string;nonce:number}|null;
  focusIssue: (selection:{type:'component'|'wire'|'bus';id:string})=>void;
  past: DigitalDocument[];
  future: DigitalDocument[];
  dragOrigin: DigitalDocument | null;
  clipboard: Clip | null;
  pasteCount: number;
  message: string;
  runtime: DigitalRuntime;
  clockStep: () => void;
  clockSteps: (count:number) => void;
  resetClock: () => void;
  setRomWords: (id:string,words:number[]) => void;
  setCasmProgram: (id:string,source:string) => boolean;
  blockLibrary: DigitalBlock[];
  favoriteKinds: DigitalKind[];
  recentKinds: DigitalKind[];
  toggleFavorite: (kind:DigitalKind) => void;
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
  startBus: (group:BusGroup) => void;
  finishBus: (group:BusGroup) => void;
  cancelBus: () => void;
  setWireLabel: (id:string,label:string) => void;
  setBusLabel: (id:string,label:string) => void;
  flipBend: (kind:'wire'|'bus',id:string) => void;
  setBend: (kind:'wire'|'bus',id:string,at:DigitalPoint) => void;
  autoRoute: (kind:'wire'|'bus',id:string) => void;
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
  ...(state.dragOrigin ? {} : {runtime:emptyDigitalRuntime(),trace:[sample(document,0)]}),
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

/** Switching workbenches does not overwrite the other lab's schematic. */
export function workspaceTransition(state:DigitalStore,next:DigitalWorkspace):Partial<DigitalStore> {
  if(next===state.activeWorkspace)return {};
  if(state.editStack.length)throw new Error(
    'Finish editing the current reusable block (Save or Cancel) before switching labs.');
  const committed=state.document;
  const destination=next==='signal'?state.signalDocument:state.computerDocument;
  const runtime=emptyDigitalRuntime();
  return {
    activeWorkspace:next,
    signalDocument:state.activeWorkspace==='signal'?committed:state.signalDocument,
    computerDocument:state.activeWorkspace==='computer'?committed:state.computerDocument,
    document:destination,
    runtime,
    selection:null,selectedIds:[],pending:null,pendingBus:null,focusTarget:null,
    past:[],future:[],dragOrigin:null,
    clipboard:null,pasteCount:0,
    probes:[],trace:[sample(destination,0,runtime)],
    message:next==='computer'?'Computer Builder · edit the CPU datapath, then step the clock.'
      :'Signal Lab · your digital logic project is restored.',
  };
}
/** Never persist a temporary block drilldown as the active circuit. */
export function persistedDigitalState(state: DigitalStore) {
  const committed=state.editStack[0]?.document ?? state.document;
  return {
    document: committed,
    activeWorkspace:state.activeWorkspace,
    signalDocument:state.activeWorkspace==='signal'?committed:state.signalDocument,
    computerDocument:state.activeWorkspace==='computer'?committed:state.computerDocument,
    blockLibrary: state.blockLibrary,
    favoriteKinds: state.favoriteKinds,
    recentKinds: state.recentKinds,
  };
}

export const useDigitalStore = create<DigitalStore>()(persist((set, get) => ({
  document: initialDigitalCircuit(),
  activeWorkspace:'signal',
  signalDocument:initialDigitalCircuit(),
  computerDocument:programmableCpuDemo(),
  switchWorkspace:destination=>{
    const state=get();
    if(state.activeWorkspace===destination)return true;
    if(state.editStack.length)return false;
    set(workspaceTransition(state,destination));
    return true;
  },
  selection: null, selectedIds: [], pending: null, pendingBus:null,focusTarget:null,
  focusIssue:target=>set(state=>({selection:target,selectedIds:target.type==='component'?[target.id]:[],
    focusTarget:{id:target.id,nonce:(state.focusTarget?.nonce??0)+1}})),
  past: [], future: [], dragOrigin: null,
  clipboard: null, pasteCount: 0,
  blockLibrary: [], favoriteKinds:[], recentKinds:[], editStack: [],
  probes: [], trace: [sample(initialDigitalCircuit(), 0)],runtime:emptyDigitalRuntime(),
  clockStep: () => set(state=>{
    const next=stepCircuit(state.document,state.runtime);
    return {runtime:next,trace:samples(state.trace,state.document,next),
      message:'Clock pulse '+next.cycle+' · stateful components updated.'};
  }),
  clockSteps: count => set(state=>{
    const n=Math.max(1,Math.min(64,Math.floor(count)));
    let next=state.runtime,trace=state.trace;
    for(let i=0;i<n;i++){
      next=stepCircuit(state.document,next);
      trace=samples(trace,state.document,next);
    }
    return {runtime:next,trace,message:'Advanced '+n+' clock pulse(s). Cycle '+next.cycle+'.'};
  }),
  resetClock: () => set(state=>{
    const runtime=resetComputer();
    return {runtime,trace:[sample(state.document,0,runtime)],
      message:'Digital register, counter and RAM state reset.'};
  }),
  setRomWords: (id,words) => set(state=>{
    if(!Array.isArray(words)||words.length!==16||
       !words.every(v=>Number.isInteger(v)&&v>=0&&v<=15))
      return {message:'ROM program requires exactly 16 values between 0 and 15.'};
    const part=state.document.components.find(c=>c.id===id&&c.kind==='rom16x4');
    if(!part)return {message:'Select a ROM to program.'};
    return patch(state,{...state.document,components:state.document.components.map(c=>
      c.id===id?{...c,words:[...words]}:c)},
      {message:'ROM program saved · 16 addressable words.'});
  }),
  setCasmProgram:(id,source)=>{
    const compiled=assembleCasm(source);
    if(!compiled.ok){
      set({message:'Assembler errors: '+compiled.issues.map(e=>'line '+e.line+': '+e.message).join(' | ')});
      return false;
    }
    const state=get();
    if(!state.document.components.some(c=>c.id===id&&c.kind==='rom16x8')){
      set({message:'Choose a 16×8 instruction ROM to load CASM code.'});
      return false;
    }
    set(current=>patch(current,{...current.document,
      components:current.document.components.map(c=>c.id===id?
        {...c,source,program:compiled.bytes}:c)},
      {message:'Assembled '+compiled.listing.length+' CASM instruction(s) to 16×8 ROM. CPU reset.'}));
    return true;
  },
  toggleFavorite: kind => set(state => ({ favoriteKinds:
    state.favoriteKinds.includes(kind) ? state.favoriteKinds.filter(k => k!==kind) : [...state.favoriteKinds,kind],
  })),
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
      probes: state.probes, trace: state.trace, runtime:state.runtime,
      clipboard: state.clipboard, pasteCount: state.pasteCount,
    };
    set({
      document: working,
      editStack: [...state.editStack, frame],
      past: [], future: [], selection: null, selectedIds: [],
      pending: null, pendingBus:null, dragOrigin: null, clipboard: null, pasteCount: 0,
      probes: [], trace: [sample(working, 0)],runtime:emptyDigitalRuntime(),
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
      pending: null, pendingBus:null, dragOrigin: null,
      probes: frame.probes, trace: [sample(parent, 0)],runtime:emptyDigitalRuntime(),
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
      pending: null, pendingBus:null, dragOrigin: null, probes: frame.probes,
      trace: frame.trace, runtime:frame.runtime, clipboard: frame.clipboard,
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
    const state=get();
    const next=applyInputVector(state.document,vector);
    const runtime=transitionInputs(state.document,next,state.runtime);
    set(current=>patch(current,next,{
      runtime,trace:samples(current.trace,next,runtime),
      message:'Applied input '+vector+' · outputs updated.',
    }));
  },
  addProbe: (kind,key,label) => set(state => {
    if (state.probes.some(p => p.kind === kind && p.key === key)) return {};
    if (state.probes.length >= 4) return {message:'Up to four signal probes can be graphed together.'};
    return {probes:[...state.probes,{id:digitalId(),kind,key,label}],
      message:'Probe attached to ' + label + '. Open WAVEFORM to inspect recorded logic events.'};
  }),
  removeProbe: id => set(state => ({probes:state.probes.filter(p=>p.id!==id)})),
  clearTrace: () => set(state=>({trace:[sample(state.document,0,state.runtime)],message:'Signal history reset.'})),
  add: (kind, at) => set(state => {
    if (kind === 'block') return { message: 'Insert a block from the saved block library.' };
    if (!digitalKinds.includes(kind)) return {message:'Unknown Signal Lab part.'};
    const c: DigitalComponent = {
      id: digitalId(), kind, x: digitalSnap(at.x), y: digitalSnap(at.y), rotation: 0,
      ...(kind === 'input' ? { bit: 0 as const } : {}),
      ...(kind === 'rom16x4' ? {words:defaultRomWords()} : {}),
      ...(kind === 'rom16x8' ? {
        source:DEFAULT_CASM_SOURCE,program:assembleCasm(DEFAULT_CASM_SOURCE).bytes,
      } : {}),
    };
    return patch(state, {
      ...state.document, components: [...state.document.components, c],
    }, {
      selection: { type: 'component', id: c.id }, selectedIds: [c.id], pending: null,pendingBus:null,
      recentKinds: [kind,...state.recentKinds.filter(k=>k!==kind)].slice(0,6),
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
  toggleInput: id => set(state=>{
    const c=state.document.components.find(c=>c.id===id&&c.kind==='input');
    if(!c)return {};
    const next:DigitalDocument={...state.document,components:state.document.components.map(p=>
      p.id===id?{...p,bit:(p.bit===1?0:1) as 0|1}:p)};
    const runtime=transitionInputs(state.document,next,state.runtime);
    return patch(state,next,{runtime,trace:samples(state.trace,next,runtime),
      message:(c.name??'Input')+' switched to '+(c.bit===1?'LOW':'HIGH')+'.'});
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
    const wireId=state.selection?.type==='wire'?state.selection.id:null;
    const busId=state.selection?.type==='bus'?state.selection.id:null;
    if(!ids.size&&!wireId&&!busId)return {};
    return patch(state, {
      ...state.document,
      components: state.document.components.filter(c => !ids.has(c.id)),
      wires: state.document.wires.filter(w =>
        w.id !== wireId &&
        !(isDigitalTerminal(w.from) && ids.has(w.from.componentId)) &&
        !(isDigitalTerminal(w.to) && ids.has(w.to.componentId))),
      buses:(state.document.buses??[]).filter(b=>b.id!==busId&&
        !ids.has(b.from.componentId)&&!ids.has(b.to.componentId)),
    }, {selection:null,selectedIds:[],pending:null,pendingBus:null});
  }),
  startWire: endpoint => set({pending:endpoint,pendingBus:null,selection:null,selectedIds:[],
    message:'Click another terminal or free space to finish the wire. ESC cancels.'}),
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
  cancelWire:()=>set({pending:null,pendingBus:null,message:'Connection drawing stopped.'}),
  startBus: group=>set(state=>{
    const part=state.document.components.find(c=>c.id===group.componentId);
    if(!part||!busGroups(part).some(g=>g.width===group.width&&
      JSON.stringify(g.pins)===JSON.stringify(group.pins)))
      return {message:'Choose a valid grouped 4/8/16-bit port.'};
    return {pending:null,pendingBus:group,selection:null,selectedIds:[],
      message:'BUS '+group.title+' ready. Click a compatible component, or right-click its grouped port. ESC cancels.'};
  }),
  finishBus:group=>set(state=>{
    const source=state.pendingBus;
    if(!source)return {message:'Choose a source bus group first.'};
    const left=state.document.components.find(c=>c.id===source.componentId);
    const right=state.document.components.find(c=>c.id===group.componentId);
    if(!left||!right||!busGroups(left).some(g=>g.width===source.width&&
      JSON.stringify(g.pins)===JSON.stringify(source.pins))||
      !busGroups(right).some(g=>g.width===group.width&&
      JSON.stringify(g.pins)===JSON.stringify(group.pins)))
      return {pendingBus:null,message:'Invalid bus port.'};
    if(source.width!==group.width)
      return {message:'Bus width mismatch: '+source.width+' bits cannot connect to '+group.width+
        ' bits. Use a matching splitter or group.'};
    if(source.componentId===group.componentId)
      return {message:'Connect the bus to a different component.'};
    const equal=(a:DigitalBusEnd,b:DigitalBusEnd)=>a.componentId===b.componentId&&
      JSON.stringify(a.pins)===JSON.stringify(b.pins);
    if((state.document.buses??[]).some(b=>(equal(b.from,source)&&equal(b.to,group))||
      (equal(b.to,source)&&equal(b.from,group))))
      return {pendingBus:null,message:'These bus ports are already connected.'};
    const bus:DigitalBus={id:digitalId(),width:source.width,
      from:{componentId:source.componentId,pins:[...source.pins]},
      to:{componentId:group.componentId,pins:[...group.pins]}};
    return patch(state,{...state.document,buses:[...(state.document.buses??[]),bus]},
      {selection:{type:'bus',id:bus.id},selectedIds:[],pendingBus:null,
        message:bus.width+'-bit bus connected, bit 0 to bit 0.'});
  }),
  cancelBus:()=>set({pendingBus:null,message:'Bus connection canceled.'}),
  setWireLabel:(id,label)=>set(state=>{
    const wire=state.document.wires.find(w=>w.id===id);
    if(!wire)return {};
    const name=label.trim();
    if(name&&!legalNetName(name))return {message:'Net name must be 1–24 letters, numbers or underscores; start with a letter or underscore.'};
    return patch(state,{...state.document,wires:state.document.wires.map(w=>w.id===id?
      {...w,label:name||undefined}:w)},
      {message:name?'Net named '+name+'. Matching one-bit nets now connect.':'Wire name cleared.'});
  }),
  setBusLabel:(id,label)=>set(state=>{
    const bus=state.document.buses?.find(b=>b.id===id);
    if(!bus)return {};
    const name=label.trim();
    if(name&&!legalNetName(name))return {message:'Use a simple bus name: letters, digits and underscores only.'};
    const conflict=(state.document.buses??[]).find(b=>b.id!==id&&b.label===name&&b.width!==bus.width);
    if(conflict)return {message:'A bus named '+name+' already has width '+conflict.width+'. Choose a different name or width.'};
    return patch(state,{...state.document,buses:state.document.buses?.map(b=>b.id===id?
      {...b,label:name||undefined}:b)},
      {message:name?'Named '+bus.width+'-bit bus '+name+'.':'Bus label cleared.'});
  }),
  flipBend:(kind,id)=>set(state=>{
    const found=kind==='wire'?state.document.wires.find(w=>w.id===id):
      state.document.buses?.find(b=>b.id===id);
    if(!found)return {};
    const path=kind==='wire'?digitalWirePath(state.document,found as DigitalWire):
      digitalBusPath(state.document,found as DigitalBus);
    if(path.length<2)return {};
    const from=path[0],to=path.at(-1)!;
    const current=path.length===3?path[1]:undefined;
    const option1={x:from.x,y:to.y},option2={x:to.x,y:from.y};
    const next=current?.x===option1.x&&current?.y===option1.y?option2:option1;
    const changed=(kind==='wire'?{wires:state.document.wires.map(w=>w.id===id?
      {...w,waypoints:[next]}:w)}:{buses:state.document.buses?.map(b=>b.id===id?
      {...b,waypoints:[next]}:b)});
    return patch(state,{...state.document,...changed},{message:'Connection bend flipped.'});
  }),
  setBend:(kind,id,at)=>set(state=>{
    const point={x:digitalSnap(at.x),y:digitalSnap(at.y)};
    const changed=kind==='wire'?{wires:state.document.wires.map(w=>w.id===id?
      {...w,waypoints:[point]}:w)}:{buses:state.document.buses?.map(b=>b.id===id?
      {...b,waypoints:[point]}:b)};
    if(kind==='wire'&&!state.document.wires.some(w=>w.id===id)||
       kind==='bus'&&!state.document.buses?.some(b=>b.id===id))return {};
    return patch(state,{...state.document,...changed},
      {message:'Bend moved. Auto-route clears custom corners.'});
  }),
  autoRoute:(kind,id)=>set(state=>{
    const changed=kind==='wire'?{wires:state.document.wires.map(w=>w.id===id?
      {...w,waypoints:[]}:w)}:{buses:state.document.buses?.map(b=>b.id===id?
      {...b,waypoints:[]}:b)};
    return patch(state,{...state.document,...changed},
      {message:'Smart orthogonal routing restored.'});
  }),
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
      future: [], runtime:emptyDigitalRuntime(),trace:[sample(state.document,0)] };
  }),
  undo: () => set(state => {
    if (!state.past.length) return {};
    return {
      document: state.past[state.past.length - 1],
      past: state.past.slice(0, -1),
      future: [state.document, ...state.future].slice(0, 80),
      selection: null, selectedIds: [], pending: null,pendingBus:null,
      dragOrigin: null,runtime:emptyDigitalRuntime(),trace:[sample(state.past[state.past.length-1],0)],
      message: 'Undo · previous digital schematic restored.',
    };
  }),
  redo: () => set(state => {
    if (!state.future.length) return {};
    return {
      document: state.future[0], future: state.future.slice(1),
      past: limit([...state.past, state.document]),
      selection: null, selectedIds: [], pending: null,pendingBus:null,
      dragOrigin: null,runtime:emptyDigitalRuntime(),trace:[sample(state.future[0],0)],
      message: 'Redo · next schematic restored.',
    };
  }),
  copy: () => set(state => {
    const ids = new Set(state.selectedIds);
    const parts = state.document.components.filter(c => ids.has(c.id));
    if (!parts.length) return { message: 'Select components before copying.' };
    return {
      clipboard: { components: parts.map(c => ({ ...c })),
        buses:(state.document.buses??[]).filter(b=>ids.has(b.from.componentId)&&
          ids.has(b.to.componentId)).map(b=>({...b,
          from:{...b.from,pins:[...b.from.pins]},
          to:{...b.to,pins:[...b.to.pins]},
          waypoints:b.waypoints?.map(p=>({...p}))})),
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
      label:undefined, // cloning a named connection must not accidentally short into the source
      waypoints: w.waypoints?.map(p => ({ x: p.x + offset, y: p.y + offset })),
    }));
    const buses=(state.clipboard.buses??[]).map(b=>({
      ...b,id:digitalId(),label:undefined,
      from:{componentId:ids.get(b.from.componentId)!,pins:[...b.from.pins]},
      to:{componentId:ids.get(b.to.componentId)!,pins:[...b.to.pins]},
      waypoints:b.waypoints?.map(p=>({x:p.x+offset,y:p.y+offset})),
    }));
    return patch(state, {
      ...state.document, components: [...state.document.components, ...comps],
      wires: [...state.document.wires, ...wires],
      buses:[...(state.document.buses??[]),...buses],
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
