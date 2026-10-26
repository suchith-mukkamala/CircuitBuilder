export type ComponentKind =
  | 'resistor' | 'voltage_source' | 'current_source' | 'ground'
  | 'switch' | 'potentiometer' | 'capacitor' | 'inductor';
export type Rotation = 0 | 90 | 180 | 270;
export type Point = { x: number; y: number };
export type PinName = 'a' | 'b' | 'g' | 'w';
export type Terminal = { componentId: string; pin: PinName };
export type WireEndpoint = Terminal | Point;

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation: Rotation;
  value: number;
  closed?: boolean;
  wiper?: number;
}
export interface Wire {
  id: string;
  from: WireEndpoint;
  to: WireEndpoint;
  waypoints?: Point[];
}
export interface CircuitDocument {
  version: 1;
  name: string;
  components: CircuitComponent[];
  wires: Wire[];
}
export type Selection = { type: 'component' | 'wire'; id: string } | null;
export type ComponentReading = { voltage: number; current: number; power: number };
export interface DCResult {
  nodeVoltages: Record<string, number>;
  terminalNodes: Record<string, string>;
  readings: Record<string, ComponentReading>;
  nodeCount: number;
}
export interface TransientFrame extends DCResult {
  time: number;
}
export interface TransientResult {
  duration: number;
  steps: number;
  frames: TransientFrame[];
}

export const GRID = 24;
// Components snap to half-cells, so a pin can always meet a free trace end.
export const snap = (n: number) => Math.round(n / (GRID / 2)) * (GRID / 2);
export const id = () => Math.random().toString(36).slice(2, 11);
export const terminalKey = (t: Terminal) => t.componentId + ':' + t.pin;
export const isTerminal = (e: WireEndpoint): e is Terminal => 'componentId' in e;
export const pinsFor = (c: CircuitComponent): PinName[] =>
  c.kind === 'ground' ? ['g'] : c.kind === 'potentiometer' ? ['a', 'b', 'w'] : ['a', 'b'];
export function pinPosition(c: CircuitComponent, pin: PinName): Point {
  const base = c.kind === 'ground'
    ? { x: 0, y: -36 }
    : c.kind === 'voltage_source' || c.kind === 'current_source'
      ? { x: 0, y: pin === 'a' ? -48 : 48 }
      : c.kind === 'potentiometer' && pin === 'w'
        ? { x: 0, y: 48 }
        : { x: pin === 'a' ? -48 : 48, y: 0 };
  const angle = (c.rotation * Math.PI) / 180;
  return {
    x: c.x + Math.round(base.x * Math.cos(angle) - base.y * Math.sin(angle)),
    y: c.y + Math.round(base.x * Math.sin(angle) + base.y * Math.cos(angle)),
  };
}
export function labelFor(c: CircuitComponent, components: CircuitComponent[]): string {
  const prefix = ({
    resistor: 'R', voltage_source: 'V', current_source: 'I', ground: 'GND',
    switch: 'S', potentiometer: 'P', capacitor: 'C', inductor: 'L',
  } as const)[c.kind];
  if (c.kind === 'ground') return 'GND';
  return prefix + (components.filter(other => other.kind === c.kind)
    .findIndex(other => other.id === c.id) + 1);
}
export function formatElectrical(value: number, unit: 'V' | 'A' | 'Ω' | 'W' | 'F' | 'H' | 's'): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-12) return '0 ' + unit;
  const abs = Math.abs(value);
  const scales = [
    { threshold: 1e9, factor: 1e9, prefix: 'G' },
    { threshold: 1e6, factor: 1e6, prefix: 'M' },
    { threshold: 1e3, factor: 1e3, prefix: 'k' },
    { threshold: 1, factor: 1, prefix: '' },
    { threshold: 1e-3, factor: 1e-3, prefix: 'm' },
    { threshold: 1e-6, factor: 1e-6, prefix: 'µ' },
    { threshold: 1e-9, factor: 1e-9, prefix: 'n' },
    { threshold: 1e-12, factor: 1e-12, prefix: 'p' },
  ];
  const scale = scales.find(s => abs >= s.threshold) ?? scales[scales.length - 1];
  return (value / scale.factor).toFixed(3).replace(/\.?0+$/, '') + ' ' + scale.prefix + unit;
}
export function isCircuitDocument(input: unknown): input is CircuitDocument {
  if (!input || typeof input !== 'object') return false;
  const d = input as Record<string, unknown>;
  if (d.version !== 1 || typeof d.name !== 'string' ||
      !Array.isArray(d.components) || !Array.isArray(d.wires) ||
      d.components.length > 1000 || d.wires.length > 3000) return false;
  const ids = new Set<string>();
  const kinds: ComponentKind[] = ['resistor', 'voltage_source', 'current_source', 'ground',
    'switch', 'potentiometer', 'capacitor', 'inductor'];
  for (const raw of d.components) {
    if (!raw || typeof raw !== 'object') return false;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== 'string' || !kinds.includes(c.kind as ComponentKind) ||
        ![0, 90, 180, 270].includes(Number(c.rotation)) ||
        !['x', 'y', 'value'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k]))) return false;
    if (c.closed !== undefined && typeof c.closed !== 'boolean') return false;
    if (c.wiper !== undefined && (typeof c.wiper !== 'number' || !Number.isFinite(c.wiper) ||
        c.wiper < .001 || c.wiper > .999)) return false;
    if (ids.has(c.id)) return false;
    ids.add(c.id);
  }
  const map = new Map((d.components as CircuitComponent[]).map(c => [c.id, c]));
  const wireIds = new Set<string>();
  const point = (p: unknown) => !!p && typeof p === 'object' &&
    typeof (p as Point).x === 'number' && Number.isFinite((p as Point).x) &&
    typeof (p as Point).y === 'number' && Number.isFinite((p as Point).y);
  const endpoint = (t: unknown): t is WireEndpoint => {
    if (!t || typeof t !== 'object') return false;
    if ('componentId' in t) {
      const term = t as Terminal;
      const c = map.get(term.componentId);
      return !!c && pinsFor(c).includes(term.pin);
    }
    return point(t);
  };
  return d.wires.every(raw => {
    if (!raw || typeof raw !== 'object') return false;
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== 'string' || wireIds.has(w.id) || !endpoint(w.from) || !endpoint(w.to)) return false;
    wireIds.add(w.id);
    return w.waypoints === undefined || (Array.isArray(w.waypoints) &&
      w.waypoints.length < 100 && w.waypoints.every(point));
  });
}
