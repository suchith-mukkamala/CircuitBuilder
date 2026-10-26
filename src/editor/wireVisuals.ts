import type {
  CircuitDocument, CircuitComponent, DCResult, PinName, Point, Wire,
} from '../circuit/types';
import { isTerminal } from '../circuit/types';
import { onWire } from '../circuit/geometry';

/**
 * Current animation is physically directed only on electrically unbranched
 * networks with exactly TWO component terminals and a single wire.
 * On branching/ideal wire meshes, individual segment currents are not unique
 * unless a wire-resistance model is introduced; there we render only
 * measured node-voltage glow rather than inventing a current direction.
 */
export function unbranchedWireCurrents(
  doc: CircuitDocument,
  solution: DCResult,
  wireNodes: Record<string, string>,
): Record<string, number> {
  const count = new Map<string, number>();
  const countWires = new Map<string, number>();
  const validPins = new Map<string, { c: CircuitComponent; pin: PinName }[]>();
  for (const c of doc.components) {
    const pins: PinName[] = c.kind === 'ground' ? ['g']
      : c.kind === 'potentiometer' ? ['a', 'b', 'w'] : ['a', 'b'];
    for (const pin of pins) {
      const root = solution.terminalNodes[c.id + ':' + pin];
      if (root === undefined) continue;
      count.set(root, (count.get(root) ?? 0) + 1);
      const entries = validPins.get(root) ?? [];
      entries.push({ c, pin });
      validPins.set(root, entries);
    }
  }
  for (const w of doc.wires) {
    const root = wireNodes[w.id];
    if (root !== undefined) countWires.set(root, (countWires.get(root) ?? 0) + 1);
  }
  const currentInjection = (c: CircuitComponent, pin: PinName): number | null => {
    if (c.kind === 'ground' || c.kind === 'potentiometer') return null;
    const reading = solution.readings[c.id];
    if (!reading || (pin !== 'a' && pin !== 'b')) return null;
    return pin === 'a' ? -reading.current : reading.current;
  };
  const result: Record<string, number> = {};
  for (const w of doc.wires) {
    const root = wireNodes[w.id];
    if (root === undefined || count.get(root) !== 2 || countWires.get(root) !== 1) continue;
    if (!isTerminal(w.from) || !isTerminal(w.to)) continue;
    const a = validPins.get(root) ?? [];
    const from = a.find(p => p.c.id === w.from.componentId && p.pin === w.from.pin);
    const to = a.find(p => p.c.id === w.to.componentId && p.pin === w.to.pin);
    if (!from || !to) continue;
    const outgoing = currentInjection(from.c, from.pin);
    const incoming = currentInjection(to.c, to.pin);
    const flow = outgoing ?? (incoming === null ? null : -incoming);
    if (flow === null || !Number.isFinite(flow) || Math.abs(flow) < 1e-11) continue;
    // Current injection into node at "from" is positive when charge travels
    // toward the far endpoint. This is a conventional-current visualization.
    result[w.id] = flow;
  }
  return result;
}

/** Explicit free endpoints that touch at least two wire paths are junctions. */
export function junctionPoints(doc: CircuitDocument): Point[] {
  const coords = new Map<string, Point>();
  for (const w of doc.wires) {
    for (const endpoint of [w.from, w.to]) {
      if (isTerminal(endpoint)) continue;
      coords.set(endpoint.x + ':' + endpoint.y, endpoint);
    }
  }
  return [...coords.values()].filter(point =>
    doc.wires.reduce((total, wire) => total + (onWire(point, wire, doc) ? 1 : 0), 0) >= 2);
}

/** A pure color cue for physically solved node voltages. No false current direction. */
export function voltageTint(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '#4bffef';
  if (value > .00001) return '#ffcb83';
  if (value < -.00001) return '#9fafff';
  return '#5bffcb';
}
