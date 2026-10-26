import {
  CircuitDocument, CircuitComponent, PinName, labelFor, pinsFor, terminalKey,
} from '../circuit/types';

function netOf(
  nodes: Record<string, string>, c: CircuitComponent, pin: PinName,
): string {
  const node = nodes[terminalKey({ componentId: c.id, pin })];
  if (node === undefined) throw new Error('Missing network node for ' + c.id + ':' + pin);
  return node;
}

/**
 * Find electrical islands that cannot obtain a DC reference potential.
 * Only components that constrain DC voltage connect the reference graph.
 *
 * Capacitors, open switches, and ideal current sources carry no conductive
 * DC path. Their terminals can be visibly wired and STILL form an
 * ungrounded island. That is physically singular, not a numerical bug.
 */
export function floatingDCNodes(
  doc: CircuitDocument, nodes: Record<string, string>, ground: string,
): string[] {
  const adjacency = new Map<string, Set<string>>();
  for (const node of Object.values(nodes)) {
    if (!adjacency.has(node)) adjacency.set(node, new Set());
  }
  adjacency.set(ground, adjacency.get(ground) ?? new Set());
  const add = (a: string, b: string) => {
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  };
  for (const c of doc.components) {
    if (c.kind === 'resistor' || c.kind === 'voltage_source' ||
        c.kind === 'inductor' || (c.kind === 'switch' && c.closed)) {
      add(netOf(nodes, c, 'a'), netOf(nodes, c, 'b'));
    }
    if (c.kind === 'potentiometer') {
      add(netOf(nodes, c, 'a'), netOf(nodes, c, 'w'));
      add(netOf(nodes, c, 'w'), netOf(nodes, c, 'b'));
    }
  }
  const reached = new Set([ground]);
  const queue = [ground];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacency.get(queue[i]) ?? []) {
      if (!reached.has(next)) {
        reached.add(next); queue.push(next);
      }
    }
  }
  return [...adjacency.keys()].filter(node => !reached.has(node));
}

export function explainFloatingNodes(
  doc: CircuitDocument, nodes: Record<string, string>, ground: string,
): string | null {
  const floating = floatingDCNodes(doc, nodes, ground);
  if (!floating.length) return null;
  const exposed = new Set(floating);
  const labels: string[] = [];
  for (const c of doc.components) {
    for (const pin of pinsFor(c)) {
      if (exposed.has(netOf(nodes, c, pin))) {
        labels.push(labelFor(c, doc.components) + '.' + pin.toUpperCase());
      }
    }
  }
  const preview = labels.slice(0, 5).join(', ');
  const remainder = labels.length > 5 ? ' +' + (labels.length - 5) + ' more' : '';
  const capacitor = doc.components.some(c => c.kind === 'capacitor');
  const openSwitch = doc.components.some(c => c.kind === 'switch' && !c.closed);
  const hint = capacitor ? ' Capacitors are open circuits in steady-state DC; try RUN TRANSIENT for charging.'
    : openSwitch ? ' An open switch may leave a part of the circuit floating.'
      : ' Verify that the listed component terminals connect to GND through a DC-conductive path.';
  return 'Floating DC node near ' + preview + remainder + '.' + hint;
}

/** Directly tying the pins of an ideal DC constraint together is redundant or inconsistent. */
export function explainIdealConstraintShort(
  doc: CircuitDocument, nodes: Record<string, string>,
): string | null {
  for (const c of doc.components) {
    if (c.kind !== 'voltage_source' && c.kind !== 'inductor' &&
        !(c.kind === 'switch' && c.closed)) continue;
    if (netOf(nodes, c, 'a') !== netOf(nodes, c, 'b')) continue;
    const name = labelFor(c, doc.components);
    if (c.kind === 'voltage_source' && c.value !== 0) {
      return name + ' is shorted: its positive and negative terminals are connected by the same net.';
    }
    return name + ' is bypassed by an ideal wire/short. Remove the redundant ideal branch.';
  }
  return null;
}
