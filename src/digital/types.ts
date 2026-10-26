export type LogicBit = 0 | 1;
export type LogicValue = 0 | 1 | 'X' | 'Z';
export type GateKind = 'and' | 'or' | 'not' | 'xor' | 'nand' | 'nor' | 'xnor' | 'buffer';
export type DigitalKind = GateKind | 'input' | 'led' | 'block';
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
};
export type DigitalWire = {
  id: string;
  from: DigitalEndpoint;
  to: DigitalEndpoint;
  waypoints?: DigitalPoint[];
};
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
  blocks?: DigitalBlock[];
};
export type DigitalSelection = { type: 'component' | 'wire'; id: string } | null;
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
export const gateKinds: GateKind[] = ['and', 'or', 'not', 'xor', 'nand', 'nor', 'xnor', 'buffer'];
export const digitalKinds: DigitalKind[] = ['input', ...gateKinds, 'led', 'block'];
export const isDigitalTerminal = (p: DigitalEndpoint): p is DigitalTerminal => 'componentId' in p;
export const isGate = (c: DigitalComponent): boolean => gateKinds.includes(c.kind as GateKind);
export const pinId = (t: DigitalTerminal) => t.componentId + ':' + t.pin;
export const pinsOf = (component: DigitalComponent): DigitalPin[] => {
  if (component.kind === 'block') return [...(component.ports?.inputs ?? []), ...(component.ports?.outputs ?? [])];
  if (component.kind === 'input') return ['out'];
  if (component.kind === 'led') return ['in'];
  if (component.kind === 'not' || component.kind === 'buffer') return ['a', 'out'];
  return ['a', 'b', 'out'];
};
export function isOutput(c: DigitalComponent, pin: DigitalPin): boolean {
  return c.kind === 'block' ? !!c.ports?.outputs.includes(pin) : pin === 'out' && c.kind !== 'led';
}
export function blockHeight(c: DigitalComponent): number {
  return Math.max(84, Math.max(c.ports?.inputs.length ?? 0, c.ports?.outputs.length ?? 0) * 24 + 36);
}
export function pinAt(component: DigitalComponent, pin: DigitalPin): DigitalPoint {
  if (component.kind === 'block') {
    const group = component.ports?.inputs.includes(pin) ? component.ports.inputs :
      component.ports?.outputs.includes(pin) ? component.ports.outputs : [];
    const side = component.ports?.inputs.includes(pin) ? -1 : 1;
    const i = Math.max(0, group.indexOf(pin));
    const local = { x: side * 78, y: (i - (group.length - 1) / 2) * 24 };
    const radians = component.rotation * Math.PI / 180;
    return { x: component.x + Math.round(local.x * Math.cos(radians) - local.y * Math.sin(radians)),
      y: component.y + Math.round(local.x * Math.sin(radians) + local.y * Math.cos(radians)) };
  }
  const local = pin === 'out' ? { x: 48, y: 0 }
    : pin === 'in' ? { x: -48, y: 0 }
      : pin === 'a' ? { x: -48, y: pinsOf(component).includes('b') ? -12 : 0 }
        : { x: -48, y: 12 };
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
        doc.components.length > 600 || doc.wires.length > 1400) return false;
    const parts = new Map<string, DigitalComponent>();
    for (const c of doc.components) {
      if (!c || typeof c.id !== 'string' || !c.id || parts.has(c.id) ||
          !digitalKinds.includes(c.kind) ||
          !validNumber(c.x) || !validNumber(c.y) ||
          ![0, 90, 180, 270].includes(c.rotation) ||
          (c.bit !== undefined && c.bit !== 0 && c.bit !== 1) ||
          (c.name !== undefined && (typeof c.name !== 'string' || c.name.length > 80))) return false;
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
              !w.waypoints.every(validPoint)))) return false;
      ids.add(w.id);
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
