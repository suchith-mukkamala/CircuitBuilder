/** Simulation-only state. Circuit JSON stays a structural schematic. */
export type DigitalRuntime = {
  cycle: number;
  registers: Record<string, Record<string, LogicValue>>;
  memories: Record<string, number[]>;
};
export const emptyDigitalRuntime = (): DigitalRuntime => ({cycle:0, registers:{}, memories:{}});
export const defaultRomWords = (): number[] => [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0];

export type LogicBit = 0 | 1;
export type LogicValue = 0 | 1 | 'X' | 'Z';
export type GateKind = 'and' | 'or' | 'not' | 'xor' | 'nand' | 'nor' | 'xnor' | 'buffer'
  | 'and3' | 'or3' | 'xor3' | 'majority' | 'mux2' | 'demux2'
  | 'halfadder' | 'fulladder' | 'alu4' | 'rom16x4';
export type SequentialKind = 'clock' | 'dff' | 'tff' | 'register4' | 'counter4' | 'ram16x4';
export type DigitalKind = GateKind | SequentialKind | 'input' | 'high' | 'low' | 'led' | 'block'
  | 'splitter4' | 'splitter8' | 'splitter16';
export type DigitalPin = string;
export type DigitalPoint = { x: number; y: number };
export type DigitalTerminal = { componentId: string; pin: DigitalPin };
export type DigitalEndpoint = DigitalTerminal | DigitalPoint;
export type DigitalComponent = {
  id: string;
  kind: DigitalKind;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  bit?: LogicBit;
  name?: string;
  blockId?: string;
  ports?: { inputs: string[]; outputs: string[] };
  /** ROM program: 16 addressable 4-bit words, editable in the inspector. */
  words?: number[];
};
export type DigitalWire = {
  id: string;
  from: DigitalEndpoint;
  to: DigitalEndpoint;
  waypoints?: DigitalPoint[];
  /** A named 1-bit net. Same names connect without a drawn trace (local to this schematic). */
  label?: string;
};
/** A real multi-bit connection: bit i of from.pins drives/connects bit i of to.pins. */
export type DigitalBusEnd = {componentId:string; pins:string[]};
export type DigitalBus = {
  id:string;
  width:4|8|16;
  from:DigitalBusEnd;
  to:DigitalBusEnd;
  label?:string;
  waypoints?:DigitalPoint[];
};
export type BusGroup = DigitalBusEnd & {width:4|8|16;direction:'in'|'out';title:string};
export const legalNetName = (s:string):boolean => /^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(s);
export type BlockPort = { pin: string; componentId: string; label: string };
export type DigitalBlock = {
  id: string;
  name: string;
  circuit: DigitalDocument;
  inputs: BlockPort[];
  outputs: BlockPort[];
};
export type DigitalDocument = {
  version: 1;
  lab: 'signal';
  name: string;
  components: DigitalComponent[];
  wires: DigitalWire[];
  buses?: DigitalBus[];
  blocks?: DigitalBlock[];
};
export type DigitalSelection = { type: 'component' | 'wire' | 'bus'; id: string } | null;
export type LogicResult = {
  terminalValues: Record<string, LogicValue>;
  wireValues: Record<string, LogicValue>;
  netValues: Record<string, LogicValue>;
  terminalNets: Record<string, string>;
  wireNets: Record<string, string>;
  ledValues: Record<string, LogicValue>;
  gateValues: Record<string, LogicValue>;
  netCount: number;
  warnings: string[];
};

export const DIGITAL_GRID = 24;
export const digitalSnap = (n: number) => Math.round(n / 12) * 12;
export const digitalId = () => Math.random().toString(36).slice(2, 11);
export const gateKinds: GateKind[] = [
  'and','or','not','xor','nand','nor','xnor','buffer',
  'and3','or3','xor3','majority','mux2','demux2','halfadder','fulladder',
  'alu4','rom16x4',
];
export const sequentialKinds: SequentialKind[] = [
  'clock','dff','tff','register4','counter4','ram16x4',
];
export const isSequential = (kind: DigitalKind): kind is SequentialKind =>
  sequentialKinds.includes(kind as SequentialKind);
export const digitalKinds: DigitalKind[] = ['input','high','low',...gateKinds,...sequentialKinds,
  'splitter4','splitter8','splitter16','led','block'];
export const isDigitalTerminal = (p: DigitalEndpoint): p is DigitalTerminal => 'componentId' in p;
export const isGate = (c: DigitalComponent): boolean => gateKinds.includes(c.kind as GateKind);
export const pinId = (t: DigitalTerminal) => t.componentId + ':' + t.pin;

const multiInputs: Partial<Record<DigitalKind, string[]>> = {
  and3:['a','b','c'], or3:['a','b','c'], xor3:['a','b','c'],
  majority:['a','b','c'], mux2:['a','b','sel'],
  demux2:['in','sel'], halfadder:['a','b'], fulladder:['a','b','cin'],
  dff:['d','clk'], tff:['t','clk'],
  register4:['d0','d1','d2','d3','clk','en'],
  counter4:['clk','en','reset'],
  rom16x4:['a0','a1','a2','a3'],
  ram16x4:['a0','a1','a2','a3','d0','d1','d2','d3','we','clk'],
  alu4:['a0','a1','a2','a3','b0','b1','b2','b3','op0','op1'],
  splitter4:Array.from({length:4},(_,i)=>'bus'+i),
  splitter8:Array.from({length:8},(_,i)=>'bus'+i),
  splitter16:Array.from({length:16},(_,i)=>'bus'+i),
};
const multiOutputs: Partial<Record<DigitalKind, string[]>> = {
  demux2:['out0','out1'], halfadder:['sum','carry'],
  fulladder:['sum','carry'],
  dff:['q'],tff:['q'],register4:['q0','q1','q2','q3'],
  counter4:['q0','q1','q2','q3'],
  rom16x4:['q0','q1','q2','q3'],
  ram16x4:['q0','q1','q2','q3'],
  alu4:['y0','y1','y2','y3','carry','zero'],
  splitter4:Array.from({length:4},(_,i)=>'bit'+i),
  splitter8:Array.from({length:8},(_,i)=>'bit'+i),
  splitter16:Array.from({length:16},(_,i)=>'bit'+i),
};
export const inputsOf = (c: DigitalComponent): DigitalPin[] => {
  if (c.kind === 'block') return [...(c.ports?.inputs ?? [])];
  if (c.kind === 'input' || c.kind === 'high' || c.kind === 'low' || c.kind==='clock') return [];
  if (c.kind === 'led') return ['in'];
  if (multiInputs[c.kind]) return [...multiInputs[c.kind]!];
  if (c.kind === 'not' || c.kind === 'buffer') return ['a'];
  return ['a','b'];
};
export const outputsOf = (c: DigitalComponent): DigitalPin[] => {
  if (c.kind === 'block') return [...(c.ports?.outputs ?? [])];
  if (c.kind === 'led') return [];
  return [...(multiOutputs[c.kind] ?? ['out'])];
};
export const pinsOf = (c: DigitalComponent): DigitalPin[] =>
  [...inputsOf(c), ...outputsOf(c)];
/** Return matching, ordered 4/8/16-bit groups, including ALU A/B buses and splitters. */
export function busGroups(c:DigitalComponent):BusGroup[]{
  const result:BusGroup[]=[];
  for(const [pins,direction] of [[inputsOf(c),'in'],[outputsOf(c),'out']] as const){
    const groups=new Map<string,string[]>();
    for(const pin of pins){
      const match=/^([A-Za-z_]+)(\d+)$/.exec(pin);
      if(!match)continue;
      const group=groups.get(match[1])??[];
      group.push(pin);groups.set(match[1],group);
    }
    for(const [prefix,items] of groups){
      const ordered=[...items].sort((a,b)=>Number(a.slice(prefix.length))-Number(b.slice(prefix.length)));
      const count=ordered.length;
      if(![4,8,16].includes(count)||ordered.some((pin,i)=>pin!==prefix+i))continue;
      result.push({componentId:c.id,pins:ordered,width:count as 4|8|16,
        direction,title:prefix.toUpperCase()+'['+(count-1)+':0]'});
    }
  }
  return result;
}
export const isOutput = (c: DigitalComponent, pin: DigitalPin): boolean =>
  outputsOf(c).includes(pin);
export const isWidePart = (c: DigitalComponent): boolean =>
  c.kind !== 'block' && (inputsOf(c).length > 2 || outputsOf(c).length > 1);
export function blockHeight(c: DigitalComponent): number {
  return Math.max(84, Math.max(c.ports?.inputs.length ?? 0, c.ports?.outputs.length ?? 0) * 24 + 36);
}
export function partHeight(c: DigitalComponent): number {
  if (c.kind === 'block') return blockHeight(c);
  if (isWidePart(c)) return Math.max(72, Math.max(inputsOf(c).length,outputsOf(c).length)*24+20);
  return 56;
}
export function localPinAt(c: DigitalComponent, pin: DigitalPin): DigitalPoint {
  const ins = inputsOf(c), outs = outputsOf(c);
  const group = ins.includes(pin) ? ins : outs;
  const side = ins.includes(pin) ? -1 : 1;
  const index = group.indexOf(pin);
  if (c.kind === 'block' || isWidePart(c)) {
    return {x:side*(c.kind==='block'?78:64),
      y:(index-(group.length-1)/2)*24};
  }
  return { x:side*48,
    y:group.length===2 ? (index===0?-12:12) : 0 };
}
export function pinAt(component: DigitalComponent, pin: DigitalPin): DigitalPoint {
  const local = localPinAt(component,pin);
  const rad = component.rotation * Math.PI / 180;
  return {
    x: component.x + Math.round(local.x * Math.cos(rad) - local.y * Math.sin(rad)),
    y: component.y + Math.round(local.x * Math.sin(rad) + local.y * Math.cos(rad)),
  };
}
export function digitalLabel(c: DigitalComponent, parts: DigitalComponent[]): string {
  if (c.name?.trim()) return c.name.trim().slice(0, 28);
  const prefix = c.kind === 'input' ? 'IN' : c.kind === 'led' ? 'LED' : c.kind === 'block' ? 'BLK' : c.kind.toUpperCase();
  return prefix + (parts.filter(p => p.kind === c.kind).findIndex(p => p.id === c.id) + 1);
}

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e7;
}
function validPoint(value: unknown): value is DigitalPoint {
  return !!value && typeof value === 'object' &&
    validNumber((value as DigitalPoint).x) && validNumber((value as DigitalPoint).y);
}
export function isDigitalDocument(input: unknown): input is DigitalDocument {
  if (!input || typeof input !== 'object') return false;
  const root = input as DigitalDocument;
  const blocks: DigitalBlock[] = Array.isArray(root.blocks) ? root.blocks : [];
  if (root.blocks !== undefined && !Array.isArray(root.blocks)) return false;
  if (blocks.length > 80) return false;
  const definitions = new Map<string, DigitalBlock>();
  for (const def of blocks) {
    if (!def || typeof def.id !== 'string' || !def.id || definitions.has(def.id) ||
        typeof def.name !== 'string' || def.name.length > 80 ||
        !Array.isArray(def.inputs) || !Array.isArray(def.outputs) ||
        !def.inputs.length || !def.outputs.length ||
        def.inputs.length > 12 || def.outputs.length > 12 ||
        !def.circuit || typeof def.circuit !== 'object') return false;
    definitions.set(def.id, def);
  }
  const validate = (doc: DigitalDocument): boolean => {
    if (doc.version !== 1 || doc.lab !== 'signal' || typeof doc.name !== 'string' ||
        !Array.isArray(doc.components) || !Array.isArray(doc.wires) ||
        doc.components.length > 600 || doc.wires.length > 1400 ||
        (doc.buses!==undefined&&(!Array.isArray(doc.buses)||doc.buses.length>500))) return false;
    const parts = new Map<string, DigitalComponent>();
    for (const c of doc.components) {
      if (!c || typeof c.id !== 'string' || !c.id || parts.has(c.id) ||
          !digitalKinds.includes(c.kind) ||
          !validNumber(c.x) || !validNumber(c.y) ||
          ![0, 90, 180, 270].includes(c.rotation) ||
          (c.bit !== undefined && c.bit !== 0 && c.bit !== 1) ||
          (c.name !== undefined && (typeof c.name !== 'string' || c.name.length > 80)) ||
          (c.words !== undefined && (c.kind !== 'rom16x4' ||
            !Array.isArray(c.words) || c.words.length !== 16 ||
            !c.words.every(v=>Number.isInteger(v)&&v>=0&&v<=15)))) return false;
      if (c.kind === 'block') {
        const def = definitions.get(c.blockId ?? '');
        if (!def || !c.ports || !Array.isArray(c.ports.inputs) || !Array.isArray(c.ports.outputs) ||
            JSON.stringify(c.ports.inputs) !== JSON.stringify(def.inputs.map(p => p.pin)) ||
            JSON.stringify(c.ports.outputs) !== JSON.stringify(def.outputs.map(p => p.pin))) return false;
      } else if (c.blockId !== undefined || c.ports !== undefined) return false;
      parts.set(c.id, c);
    }
    const validEndpoint = (e: DigitalEndpoint) => {
      if (!e || typeof e !== 'object') return false;
      if ('componentId' in e) {
        const part = parts.get(e.componentId);
        return !!part && pinsOf(part).includes(e.pin);
      }
      return validPoint(e);
    };
    const ids = new Set<string>();
    for (const w of doc.wires) {
      if (!w || typeof w.id !== 'string' || !w.id || ids.has(w.id) ||
          !validEndpoint(w.from) || !validEndpoint(w.to) ||
          (w.waypoints !== undefined &&
            (!Array.isArray(w.waypoints) || w.waypoints.length > 100 ||
              !w.waypoints.every(validPoint))) ||
          (w.label!==undefined&&(!legalNetName(w.label)))) return false;
      ids.add(w.id);
    }
    const busIds=new Set<string>();
    for(const bus of doc.buses??[]){
      if(!bus||typeof bus.id!=='string'||!bus.id||busIds.has(bus.id)||
        ![4,8,16].includes(bus.width)||
        (bus.label!==undefined&&!legalNetName(bus.label))||
        (bus.waypoints!==undefined&&(!Array.isArray(bus.waypoints)||
          bus.waypoints.length>40||!bus.waypoints.every(validPoint))))return false;
      busIds.add(bus.id);
      for(const end of [bus.from,bus.to]){
        const part=parts.get(end?.componentId);
        if(!part||!Array.isArray(end.pins)||end.pins.length!==bus.width||
          new Set(end.pins).size!==bus.width||
          end.pins.some(pin=>typeof pin!=='string'||!pinsOf(part).includes(pin)))return false;
        if(!busGroups(part).some(g=>g.width===bus.width&&
            JSON.stringify(g.pins)===JSON.stringify(end.pins)))return false;
      }
    }
    return true;
  };
  if (!validate(root)) return false;
  for (const def of blocks) {
    if (!validate(def.circuit)) return false;
    const inner = new Map(def.circuit.components.map(c => [c.id, c]));
    const allPins = new Set<string>();
    for (const [ports,kind] of [[def.inputs, 'input'], [def.outputs, 'led']] as const) {
      for (const port of ports) {
        if (!port || !/^in\d+$|^out\d+$/.test(port.pin) ||
            allPins.has(port.pin) || typeof port.label !== 'string' ||
            port.label.length > 28 || inner.get(port.componentId)?.kind !== kind) return false;
        allPins.add(port.pin);
      }
    }
    if (def.circuit.blocks?.length) return false; // definitions use the root catalog
  }
  return true;
}

export function initialDigitalCircuit(): DigitalDocument {
  return {
    version: 1, lab: 'signal', name: 'XOR Playground',
    components: [
      { id: 'a', kind: 'input', name: 'A', x: 144, y: 168, rotation: 0, bit: 0 },
      { id: 'b', kind: 'input', name: 'B', x: 144, y: 288, rotation: 0, bit: 1 },
      { id: 'xor1', kind: 'xor', x: 384, y: 228, rotation: 0 },
      { id: 'led1', kind: 'led', name: 'OUT', x: 624, y: 228, rotation: 0 },
    ],
    wires: [
      { id: 'w1', from: { componentId: 'a', pin: 'out' }, to: { componentId: 'xor1', pin: 'a' } },
      { id: 'w2', from: { componentId: 'b', pin: 'out' }, to: { componentId: 'xor1', pin: 'b' } },
      { id: 'w3', from: { componentId: 'xor1', pin: 'out' }, to: { componentId: 'led1', pin: 'in' } },
    ],
  };
}
