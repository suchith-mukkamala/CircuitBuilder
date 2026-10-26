export type ComponentKind = 'resistor' | 'voltage_source' | 'ground';
export type Rotation = 0 | 90 | 180 | 270;
export type Point = { x: number; y: number };
export type PinName = 'a' | 'b' | 'g';
export type Terminal = { componentId: string; pin: PinName };

export interface CircuitComponent {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation: Rotation;
  value: number;
}

export interface Wire {
  id: string;
  from: Terminal;
  to: Terminal;
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

export const GRID = 24;
export const snap = (n: number) => Math.round(n / GRID) * GRID;
export const id = () => Math.random().toString(36).slice(2, 11);
export const terminalKey = (t: Terminal) => t.componentId + ':' + t.pin;
export const pinsFor = (c: CircuitComponent): PinName[] => c.kind === 'ground' ? ['g'] : ['a', 'b'];

export function pinPosition(c: CircuitComponent, pin: PinName): Point {
  const base = c.kind === 'ground'
    ? { x: 0, y: -36 }
    : c.kind === 'voltage_source'
      ? { x: 0, y: pin === 'a' ? -48 : 48 }
      : { x: pin === 'a' ? -48 : 48, y: 0 };
  const angle = (c.rotation * Math.PI) / 180;
  return {
    x: c.x + Math.round(base.x * Math.cos(angle) - base.y * Math.sin(angle)),
    y: c.y + Math.round(base.x * Math.sin(angle) + base.y * Math.cos(angle)),
  };
}

export function labelFor(c: CircuitComponent, components: CircuitComponent[]): string {
  const prefix = c.kind === 'resistor' ? 'R' : c.kind === 'voltage_source' ? 'V' : 'GND';
  if (c.kind === 'ground') return 'GND';
  const sameKind = components.filter(other => other.kind === c.kind);
  return prefix + (sameKind.findIndex(other => other.id === c.id) + 1);
}

export function formatElectrical(value: number, unit: 'V' | 'A' | 'Ω' | 'W'): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const scales = [
    { threshold: 1e9, factor: 1e9, prefix: 'G' },
    { threshold: 1e6, factor: 1e6, prefix: 'M' },
    { threshold: 1e3, factor: 1e3, prefix: 'k' },
    { threshold: 1, factor: 1, prefix: '' },
    { threshold: 1e-3, factor: 1e-3, prefix: 'm' },
    { threshold: 1e-6, factor: 1e-6, prefix: 'µ' },
    { threshold: 1e-9, factor: 1e-9, prefix: 'n' },
  ];
  const scale = scales.find(s => abs >= s.threshold) ?? scales[scales.length - 1];
  return (Math.abs(value) < 1e-12 ? '0' : (value / scale.factor).toFixed(3).replace(/\.?0+$/, '')) + ' ' + scale.prefix + unit;
}

export function isCircuitDocument(input: unknown): input is CircuitDocument {
  if (!input || typeof input !== 'object') return false;
  const d = input as Record<string, unknown>;
  if (d.version !== 1 || typeof d.name !== 'string' ||
      !Array.isArray(d.components) || !Array.isArray(d.wires) ||
      d.components.length > 1000 || d.wires.length > 3000) return false;
  const ids = new Set<string>();
  for (const raw of d.components) {
    if (!raw || typeof raw !== 'object') return false;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== 'string' || !['resistor', 'voltage_source', 'ground'].includes(String(c.kind)) ||
      ![0, 90, 180, 270].includes(Number(c.rotation)) ||
      !['x', 'y', 'value'].every(k => typeof c[k] === 'number' && Number.isFinite(c[k]))) return false;
    if (ids.has(c.id)) return false;
    ids.add(c.id);
  }
  return d.wires.every(raw => {
    if (!raw || typeof raw !== 'object') return false;
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== 'string') return false;
    const valid = (t: unknown) => !!t && typeof t === 'object' &&
      ids.has(String((t as Terminal).componentId)) &&
      ['a', 'b', 'g'].includes(String((t as Terminal).pin));
    if (!valid(w.from) || !valid(w.to)) return false;
    if (w.waypoints !== undefined && (!Array.isArray(w.waypoints) ||
      !w.waypoints.every(p => p && typeof p.x === 'number' && Number.isFinite(p.x) &&
        typeof p.y === 'number' && Number.isFinite(p.y)))) return false;
    return true;
  });
}
