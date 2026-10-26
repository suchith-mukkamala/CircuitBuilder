import {
  CircuitDocument, PinName, pinsFor, terminalKey, isTerminal, pinPosition, WireEndpoint, Point,
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
  const coords = new Set<string>();
  const ensurePoint = (p: Point): string => {
    const key = pointKey(p);
    set.add(key);
    coords.add(key);
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

  // Join wires that end on another wire's segment, plus any component terminal
  // placed directly on an existing trace.
  for (const w of doc.wires) {
    const wireNode = 'wire:' + w.id;
    for (const term of terminals) {
      // Preserve legacy terminal-to-terminal drawings: a pad that already has
      // an explicit wire does not automatically connect to an unrelated trace
      // merely passing through its visible position.
      if (!explicitlyWired.has(term.key) && onWire(term.point, w, doc)) {
        set.union(wireNode, term.key);
      }
    }
    for (const p of freeEnds) {
      if (onWire(p, w, doc)) set.union(wireNode, pointKey(p));
    }
  }

  const connected = new Set<string>(explicitlyWired);
  for (const t of terminals) {
    if (!explicitlyWired.has(t.key) && doc.wires.some(w => onWire(t.point, w, doc))) {
      connected.add(t.key);
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
        throw new Error('Connect both terminals of ' + c.id.toUpperCase() +
          ' (and the W pin, for a potentiometer) before simulating.');
      }
    }
  }

  const terminalNodes: Record<string, string> = {};
  for (const t of terminals) terminalNodes[t.key] = set.find(t.key);
  return { terminalNodes, ground: set.find(grounds[0].key) };
}
