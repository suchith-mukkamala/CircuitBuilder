export type LogicBit = 0 | 1;
export type LogicValue = 0 | 1 | 'X' | 'Z';
export type GateKind = 'and' | 'or' | 'not' | 'xor' | 'nand' | 'nor' | 'xnor' | 'buffer';
export type DigitalKind = GateKind | 'input' | 'led';
export type DigitalPin = 'a' | 'b' | 'out' | 'in';
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
};
export type DigitalWire = {
  id: string;
  from: DigitalEndpoint;
  to: DigitalEndpoint;
  waypoints?: DigitalPoint[];
};
export type DigitalDocument = {
  version: 1;
  lab: 'signal';
  name: string;
  components: DigitalComponent[];
  wires: DigitalWire[];
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
export const digitalKinds: DigitalKind[] = ['input', ...gateKinds, 'led'];
export const isDigitalTerminal = (p: DigitalEndpoint): p is DigitalTerminal => 'componentId' in p;
export const isGate = (c: DigitalComponent): boolean => gateKinds.includes(c.kind as GateKind);
export const pinId = (t: DigitalTerminal) => t.componentId + ':' + t.pin;
export const pinsOf = (component: DigitalComponent): DigitalPin[] => {
  if (component.kind === 'input') return ['out'];
  if (component.kind === 'led') return ['in'];
  if (component.kind === 'not' || component.kind === 'buffer') return ['a', 'out'];
  return ['a', 'b', 'out'];
};
export function isOutput(c: DigitalComponent, pin: DigitalPin): boolean {
  return pin === 'out' && c.kind !== 'led';
}
export function pinAt(component: DigitalComponent, pin: DigitalPin): DigitalPoint {
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
  const prefix = c.kind === 'input' ? 'IN' : c.kind === 'led' ? 'LED' : c.kind.toUpperCase();
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
  const doc = input as Record<string, unknown>;
  if (doc.version !== 1 || doc.lab !== 'signal' || typeof doc.name !== 'string' ||
      !Array.isArray(doc.components) || !Array.isArray(doc.wires) ||
      doc.components.length > 600 || doc.wires.length > 1400) return false;
  const parts = new Map<string, DigitalComponent>();
  for (const raw of doc.components) {
    if (!raw || typeof raw !== 'object') return false;
    const c = raw as DigitalComponent;
    if (typeof c.id !== 'string' || !c.id || parts.has(c.id) ||
        !digitalKinds.includes(c.kind) ||
        !validNumber(c.x) || !validNumber(c.y) ||
        ![0, 90, 180, 270].includes(c.rotation) ||
        (c.bit !== undefined && c.bit !== 0 && c.bit !== 1) ||
        (c.name !== undefined && (typeof c.name !== 'string' || c.name.length > 80))) return false;
    parts.set(c.id, c);
  }
  const validEndpoint = (endpoint: unknown): endpoint is DigitalEndpoint => {
    if (!endpoint || typeof endpoint !== 'object') return false;
    if ('componentId' in endpoint) {
      const term = endpoint as DigitalTerminal;
      const part = parts.get(term.componentId);
      return !!part && pinsOf(part).includes(term.pin);
    }
    return validPoint(endpoint);
  };
  const wireIds = new Set<string>();
  for (const raw of doc.wires) {
    if (!raw || typeof raw !== 'object') return false;
    const wire = raw as DigitalWire;
    if (typeof wire.id !== 'string' || !wire.id || wireIds.has(wire.id) ||
        !validEndpoint(wire.from) || !validEndpoint(wire.to) ||
        (wire.waypoints !== undefined &&
          (!Array.isArray(wire.waypoints) || wire.waypoints.length > 100 ||
            !wire.waypoints.every(validPoint)))) return false;
    wireIds.add(wire.id);
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
