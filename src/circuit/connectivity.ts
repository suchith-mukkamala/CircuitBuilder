import { CircuitDocument, PinName, pinsFor, terminalKey } from './types';

export class DisjointSet {
  private parent = new Map<string, string>();
  add(key: string): void { if (!this.parent.has(key)) this.parent.set(key, key); }
  find(key: string): string {
    const parent = this.parent.get(key);
    if (parent === undefined) throw new Error('Unknown terminal: ' + key);
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

export function circuitNodes(doc: CircuitDocument): { terminalNodes: Record<string, string>; ground: string } {
  const set = new DisjointSet();
  const terminals = new Set<string>();
  const componentMap = new Map(doc.components.map(c => [c.id, c]));
  for (const component of doc.components) {
    for (const pin of pinsFor(component)) {
      const key = terminalKey({ componentId: component.id, pin });
      terminals.add(key);
      set.add(key);
    }
  }
  const grounds = doc.components.filter(c => c.kind === 'ground');
  if (grounds.length === 0) throw new Error('Add a ground component (GND) before simulating.');
  const groundKey = terminalKey({ componentId: grounds[0].id, pin: 'g' });
  for (const g of grounds.slice(1)) set.union(groundKey, terminalKey({ componentId: g.id, pin: 'g' }));
  const degrees = new Map<string, number>();
  for (const wire of doc.wires) {
    const a = terminalKey(wire.from), b = terminalKey(wire.to);
    const ca = componentMap.get(wire.from.componentId);
    const cb = componentMap.get(wire.to.componentId);
    const correctPin = (kind: string | undefined, pin: PinName) =>
      kind === 'ground' ? pin === 'g' : (pin === 'a' || pin === 'b');
    if (!terminals.has(a) || !terminals.has(b) ||
      !correctPin(ca?.kind, wire.from.pin) || !correctPin(cb?.kind, wire.to.pin)) {
      throw new Error('A wire references a missing component or terminal.');
    }
    set.union(a, b);
    degrees.set(a, (degrees.get(a) ?? 0) + 1);
    degrees.set(b, (degrees.get(b) ?? 0) + 1);
  }
  for (const component of doc.components) {
    if (component.kind === 'ground') continue;
    for (const pin of pinsFor(component)) {
      if (!degrees.has(terminalKey({ componentId: component.id, pin }))) {
        throw new Error('Connect both terminals of ' + component.id.toUpperCase() + ' before simulating.');
      }
    }
  }
  const terminalNodes: Record<string, string> = {};
  for (const key of terminals) terminalNodes[key] = set.find(key);
  return { terminalNodes, ground: set.find(groundKey) };
}
