import {
  CircuitDocument, PinName, pinsFor, labelFor, terminalKey, isTerminal, pinPosition, WireEndpoint, Point,
} from './types';
import { endpointPosition, onWire } from './geometry';

export class DisjointSet {
  private parent = new Map<string, string>();
  add(key: string): void { if (!this.parent.has(key)) this.parent.set(key, key); }
  find(key: string): string {
    const parent = this.parent.get(key);
    if (parent === undefined) throw new Error('Unknown electrical node: ' + key);
    if (parent === key) return key;
    const root = this.find(parent);
    this.parent.set(key, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/** Free ends and terminal pads share the same coordinate anchors. */
const pointKey = (p: Point) => 'xy:' + p.x + ',' + p.y;
const endpointKey = (e: WireEndpoint) => isTerminal(e) ? terminalKey(e) : pointKey(e);

/**
 * Connectivity only occurs where a terminal pad or wire endpoint actually
 * touches a wire. Two wires merely crossing without an endpoint/pad do NOT
 * connect. A free wire end can be attached by placing a component pin there,
 * or by branching from that point later.
 */
export function circuitNodes(doc: CircuitDocument): {
  terminalNodes: Record<string, string>;
  ground: string;
} {
  const set = new DisjointSet();
  const componentMap = new Map(doc.components.map(c => [c.id, c]));
  const terminals: { key: string; point: Point; componentId: string; pin: PinName }[] = [];
  const ensurePoint = (p: Point): string => {
    const key = pointKey(p);
    set.add(key);
    return key;
  };
  for (const c of doc.components) {
    for (const pin of pinsFor(c)) {
      const term = { componentId: c.id, pin };
      const key = terminalKey(term);
      const point = pinPosition(c, pin);
      set.add(key);
      set.union(key, ensurePoint(point));
      terminals.push({ key, point, ...term });
    }
  }
  const grounds = terminals.filter(t => componentMap.get(t.componentId)?.kind === 'ground');
  if (grounds.length === 0) throw new Error('Add a ground component (GND) before simulating.');
  for (const g of grounds.slice(1)) set.union(grounds[0].key, g.key);

  const freeEnds: Point[] = [];
  const explicitlyWired = new Set<string>();
  for (const w of doc.wires) {
    const wireNode = 'wire:' + w.id;
    set.add(wireNode);
    for (const end of [w.from, w.to]) {
      if (isTerminal(end)) {
        const c = componentMap.get(end.componentId);
        if (!c || !pinsFor(c).includes(end.pin)) {
          throw new Error('A wire references a missing component or terminal.');
        }
        set.union(wireNode, terminalKey(end));
        explicitlyWired.add(terminalKey(end));
      } else {
        set.union(wireNode, ensurePoint(end));
        freeEnds.push(end);
      }
    }
    if (!endpointPosition(w.from, doc) || !endpointPosition(w.to, doc)) {
      throw new Error('A wire endpoint could not be resolved.');
    }
  }

  // A *free endpoint* on a wire segment is an intentional junction.
  // Pure crossings, and pads underneath an unrelated trace, DO NOT join.
  for (const w of doc.wires) {
    const wireNode = 'wire:' + w.id;
    for (const p of freeEnds) {
      if (onWire(p, w, doc)) set.union(wireNode, pointKey(p));
    }
  }

  const connected = new Set<string>(explicitlyWired);
  // A terminal deliberately placed onto the middle of a visible wire must
  // become part of that electrical net. Previously this looked connected
  // on screen but was silently omitted from the MNA connectivity graph,
  // producing misleading "floating node" / singular-matrix errors.
  // Pads already wired explicitly keep their original connections: merely
  // dragging their body across a different trace cannot short two nets.
  for (const t of terminals) {
    if (freeEnds.some(p => p.x === t.point.x && p.y === t.point.y)) {
      connected.add(t.key);
    }
    if (explicitlyWired.has(t.key)) continue;
    for (const w of doc.wires) {
      if (onWire(t.point, w, doc)) {
        set.union(t.key, 'wire:' + w.id);
        connected.add(t.key);
      }
    }
  }
  // A component pad touching another component pad is a direct connection.
  for (const t of terminals) {
    if (terminals.some(other => other.key !== t.key &&
      t.point.x === other.point.x && t.point.y === other.point.y)) connected.add(t.key);
  }
  for (const c of doc.components) {
    if (c.kind === 'ground') continue;
    for (const pin of pinsFor(c)) {
      const key = terminalKey({ componentId: c.id, pin });
      if (!connected.has(key)) {
        throw new Error('Connect both terminals of ' + labelFor(c, doc.components) +
          ' before simulating. Open pin: ' + pin.toUpperCase() +
          '. Drag the pin onto a wire or connect it directly (green contact must snap to trace).');
      }
    }
  }

  const terminalNodes: Record<string, string> = {};
  for (const t of terminals) terminalNodes[t.key] = set.find(t.key);
  return { terminalNodes, ground: set.find(grounds[0].key) };
}
