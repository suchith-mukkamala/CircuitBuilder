import {
  DigitalDocument, DigitalEndpoint, DigitalPoint, DigitalTerminal, DigitalWire,
  isDigitalTerminal, pinAt, pinId, pinsOf,
} from './types';

class UnionFind {
  private parent = new Map<string, string>();
  add(key: string) { if (!this.parent.has(key)) this.parent.set(key, key); }
  find(key: string): string {
    const p = this.parent.get(key);
    if (p === undefined) throw new Error('Missing signal node: ' + key);
    if (p === key) return p;
    const root = this.find(p);
    this.parent.set(key, root);
    return root;
  }
  union(a: string, b: string) {
    const rootA = this.find(a), rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}
export const coordKey = (p: DigitalPoint) => 'xy:' + p.x + ',' + p.y;
export function endpointPoint(doc: DigitalDocument, endpoint: DigitalEndpoint): DigitalPoint | null {
  if (!isDigitalTerminal(endpoint)) return endpoint;
  const part = doc.components.find(c => c.id === endpoint.componentId);
  return part && pinsOf(part).includes(endpoint.pin) ? pinAt(part, endpoint.pin) : null;
}
export function digitalWirePath(doc: DigitalDocument, wire: DigitalWire): DigitalPoint[] {
  const from = endpointPoint(doc, wire.from), to = endpointPoint(doc, wire.to);
  if (!from || !to) return [];
  const anchors = [from, ...(wire.waypoints?.length ? wire.waypoints :
    [{ x: to.x, y: from.y }]), to];
  const points: DigitalPoint[] = [anchors[0]];
  for (const next of anchors.slice(1)) {
    const prev = points[points.length - 1];
    if (next.x !== prev.x && next.y !== prev.y) points.push({ x: next.x, y: prev.y });
    if (next.x !== prev.x || next.y !== prev.y) points.push(next);
  }
  return points;
}
export function onDigitalWire(doc: DigitalDocument, wire: DigitalWire, p: DigitalPoint): boolean {
  const path = digitalWirePath(doc, wire);
  return path.some((a, i) => {
    if (!i) return false;
    const b = path[i - 1];
    return a.x === b.x
      ? p.x === a.x && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y)
      : p.y === a.y && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x);
  });
}
export function intentionalJunctions(doc: DigitalDocument): DigitalPoint[] {
  const tips = new Map<string, DigitalPoint>();
  for (const wire of doc.wires) {
    for (const end of [wire.from, wire.to]) {
      if (!isDigitalTerminal(end)) tips.set(coordKey(end), end);
    }
  }
  return [...tips.values()].filter(point =>
    doc.wires.filter(wire => onDigitalWire(doc, wire, point)).length >= 2);
}
export interface SignalNetwork {
  terminals: Record<string, string>;
  wires: Record<string, string>;
  roots: string[];
}

/**
 * A digital wire only joins another at an explicit endpoint or component pad.
 * Mere perpendicular crossings are never electrical connections.
 */
export function buildSignalNetwork(doc: DigitalDocument): SignalNetwork {
  const union = new UnionFind();
  const terms: { terminal: DigitalTerminal; point: DigitalPoint }[] = [];
  const explicit = new Set<string>();
  for (const c of doc.components) {
    for (const pin of pinsOf(c)) {
      const terminal = { componentId: c.id, pin };
      const point = pinAt(c, pin);
      const key = pinId(terminal), pos = coordKey(point);
      union.add(key); union.add(pos); union.union(key, pos);
      terms.push({ terminal, point });
    }
  }
  const tips: DigitalPoint[] = [];
  for (const wire of doc.wires) {
    const key = 'wire:' + wire.id;
    union.add(key);
    for (const endpoint of [wire.from, wire.to]) {
      if (isDigitalTerminal(endpoint)) {
        const term = pinId(endpoint);
        union.add(term); union.union(key, term); explicit.add(term);
      } else {
        const point = coordKey(endpoint);
        union.add(point); union.union(key, point);
        tips.push(endpoint);
      }
    }
  }
  for (const wire of doc.wires) {
    for (const point of tips) {
      if (onDigitalWire(doc, wire, point)) {
        union.union('wire:' + wire.id, coordKey(point));
      }
    }
  }
  for (const { terminal, point } of terms) {
    if (explicit.has(pinId(terminal))) continue;
    for (const wire of doc.wires) {
      if (onDigitalWire(doc, wire, point)) union.union(pinId(terminal), 'wire:' + wire.id);
    }
  }
  const terminals: Record<string, string> = {}, wires: Record<string, string> = {};
  for (const { terminal } of terms) terminals[pinId(terminal)] = union.find(pinId(terminal));
  for (const wire of doc.wires) wires[wire.id] = union.find('wire:' + wire.id);
  return {
    terminals, wires,
    roots: [...new Set([...Object.values(terminals), ...Object.values(wires)])].sort(),
  };
}
