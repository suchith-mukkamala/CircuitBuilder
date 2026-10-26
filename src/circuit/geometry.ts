import {
  CircuitDocument, Wire, WireEndpoint, Point, isTerminal, pinPosition, terminalKey, pinsFor,
} from './types';

/** Return a terminal's visual position or the stored free wire-end location. */
export function endpointPosition(endpoint: WireEndpoint, doc: CircuitDocument): Point | null {
  if (!isTerminal(endpoint)) return endpoint;
  const c = doc.components.find(part => part.id === endpoint.componentId);
  if (!c || !pinsFor(c).includes(endpoint.pin)) return null;
  return pinPosition(c, endpoint.pin);
}

/** Orthogonal Manhattan trace; intermediate corner segments have no automatic junction. */
export function wirePath(wire: Wire, doc: CircuitDocument): Point[] {
  const start = endpointPosition(wire.from, doc), end = endpointPosition(wire.to, doc);
  if (!start || !end) return [];
  const anchors = [start, ...(wire.waypoints?.length
    ? wire.waypoints : [{ x: end.x, y: start.y }]), end];
  const result: Point[] = [anchors[0]];
  for (const next of anchors.slice(1)) {
    const last = result[result.length - 1];
    if (last.x !== next.x && last.y !== next.y) result.push({ x: last.x, y: next.y });
    if (last.x !== next.x || last.y !== next.y) result.push(next);
  }
  return result;
}
export function onSegment(p: Point, a: Point, b: Point, eps = .001): boolean {
  if (Math.abs(a.x - b.x) < eps) {
    return Math.abs(p.x - a.x) < eps &&
      p.y >= Math.min(a.y, b.y) - eps && p.y <= Math.max(a.y, b.y) + eps;
  }
  if (Math.abs(a.y - b.y) < eps) {
    return Math.abs(p.y - a.y) < eps &&
      p.x >= Math.min(a.x, b.x) - eps && p.x <= Math.max(a.x, b.x) + eps;
  }
  return false;
}
export function onWire(p: Point, w: Wire, doc: CircuitDocument): boolean {
  const path = wirePath(w, doc);
  return path.some((point, i) => i > 0 && onSegment(p, path[i - 1], point));
}
export function terminalAt(doc: CircuitDocument, p: Point): string[] {
  const result: string[] = [];
  for (const c of doc.components) {
    for (const pin of pinsFor(c)) {
      const pos = pinPosition(c, pin);
      if (pos.x === p.x && pos.y === p.y) result.push(terminalKey({ componentId: c.id, pin }));
    }
  }
  return result;
}
