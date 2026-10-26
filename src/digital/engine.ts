import {
  DigitalDocument, DigitalComponent, GateKind, LogicBit, LogicValue, LogicResult,
} from './types';
import { compileSignals } from './compile';

export function evaluateGate(kind: GateKind, a: LogicValue, b: LogicValue = 'Z'): LogicValue {
  const inputA: LogicValue = a === 'Z' ? 'X' : a;
  const inputB: LogicValue = b === 'Z' ? 'X' : b;
  if (kind === 'buffer') return inputA;
  if (kind === 'not') return inputA === 'X' ? 'X' : inputA === 0 ? 1 : 0;
  if (kind === 'and' || kind === 'nand') {
    const signal = inputA === 0 || inputB === 0 ? 0
      : inputA === 1 && inputB === 1 ? 1 : 'X';
    return kind === 'and' || signal === 'X' ? signal : signal === 0 ? 1 : 0;
  }
  if (kind === 'or' || kind === 'nor') {
    const signal = inputA === 1 || inputB === 1 ? 1
      : inputA === 0 && inputB === 0 ? 0 : 'X';
    return kind === 'or' || signal === 'X' ? signal : signal === 0 ? 1 : 0;
  }
  if (inputA === 'X' || inputB === 'X') return 'X';
  const signal = inputA === inputB ? 0 : 1;
  return kind === 'xor' ? signal : signal === 0 ? 1 : 0;
}
export const isBinary = (value: LogicValue): value is LogicBit => value === 0 || value === 1;

/**
 * Pure four-state combinational solver over a flattened hierarchy of modules.
 * Modules reuse definitions but always have isolated gate instances.
 * Input/LED interface components are nets, not duplicated active drivers.
 */
export function simulateLogic(doc: DigitalDocument): LogicResult {
  const network = compileSignals(doc);
  const primitives = network.primitives;
  const gates = primitives.filter(p => p.component.kind !== 'input' && p.component.kind !== 'led');
  const drivers = primitives.filter(p => p.output);
  let computed = new Map<string, LogicValue>(gates.map(p => [p.id, 'X']));
  let netValues = new Map<string, LogicValue>();
  const conflicts = new Set<string>();
  const updateNets = (): Map<string, LogicValue> => {
    const incoming = new Map<string, LogicValue[]>();
    for (const root of network.roots) incoming.set(root, []);
    for (const p of drivers) {
      if (!p.output) continue;
      incoming.get(p.output)?.push(
        p.component.kind === 'input' ? (p.component.bit ?? 0) : (computed.get(p.id) ?? 'X'),
      );
    }
    const next = new Map<string, LogicValue>();
    for (const root of network.roots) {
      const sources = incoming.get(root) ?? [];
      if (sources.length > 1) {
        next.set(root, 'X'); conflicts.add(root);
      } else next.set(root, sources.length ? sources[0] : 'Z');
    }
    return next;
  };
  let stabilized = false;
  for (let iteration = 0; iteration < Math.max(6, gates.length + 3); iteration++) {
    const nextNet = updateNets();
    const nextGates = new Map<string, LogicValue>();
    for (const p of gates) {
      const kind = p.component.kind as GateKind;
      const a = nextNet.get(p.a ?? '') ?? 'Z';
      const b = p.b ? nextNet.get(p.b) ?? 'Z' : 'Z';
      nextGates.set(p.id, evaluateGate(kind, a, b));
    }
    stabilized = [...nextGates].every(([id, value]) => computed.get(id) === value);
    netValues = nextNet;
    computed = nextGates;
    if (stabilized) break;
  }
  netValues = updateNets();
  if (!stabilized) {
    for (const p of gates) computed.set(p.id, 'X');
    netValues = updateNets();
  }
  const terminalValues: Record<string, LogicValue> = {};
  const wireValues: Record<string, LogicValue> = {};
  for (const [key, root] of Object.entries(network.terminals)) {
    terminalValues[key] = netValues.get(root) ?? 'Z';
  }
  for (const [key, root] of Object.entries(network.wires)) {
    wireValues[key] = netValues.get(root) ?? 'Z';
  }
  const ledValues: Record<string, LogicValue> = {};
  const gateValues: Record<string, LogicValue> = {};
  for (const c of doc.components) {
    if (c.kind === 'led') ledValues[c.id] = terminalValues[c.id + ':in'] ?? 'Z';
    else if (c.kind === 'block') {
      gateValues[c.id] = terminalValues[c.id + ':' + (c.ports?.outputs[0] ?? '')] ?? 'Z';
    } else if (c.kind !== 'input') gateValues[c.id] = computed.get('top/' + c.id) ?? 'X';
  }
  const warnings: string[] = [];
  for (const p of primitives) {
    if (p.component.kind === 'input') continue;
    const check = p.component.kind === 'led'
      ? [{pin:'IN', net:p.input}]
      : [{pin:'A',net:p.a}, ...(p.b ? [{pin:'B',net:p.b}] : [])];
    for (const input of check) {
      if ((netValues.get(input.net ?? '') ?? 'Z') === 'Z') {
        warnings.push(p.label + '.' + input.pin + ' has no driver.');
      }
    }
  }
  for (const c of doc.components.filter(c => c.kind === 'block')) {
    for (const pin of c.ports?.inputs ?? []) {
      if (terminalValues[c.id + ':' + pin] === 'Z') {
        warnings.push((c.name ?? 'BLOCK') + '.' + pin + ' has no driver.');
      }
    }
  }
  if (conflicts.size) warnings.push(conflicts.size + ' net(s) have multiple active outputs connected together.');
  if (!stabilized) warnings.push('Combinational feedback did not settle; check for loops without storage.');
  return {
    terminalValues, wireValues,
    netValues: Object.fromEntries(netValues),
    terminalNets: network.terminals, wireNets: network.wires,
    ledValues, gateValues, netCount: network.roots.length, warnings,
  };
}

export type TruthTable = {
  inputs: DigitalComponent[];
  outputs: DigitalComponent[];
  rows: { inputs: LogicBit[]; outputs: LogicValue[] }[];
};
export function generateTruthTable(doc: DigitalDocument): TruthTable {
  const inputs = doc.components.filter(c => c.kind === 'input');
  const outputs = doc.components.filter(c => c.kind === 'led');
  if (!inputs.length) throw new Error('Add at least one INPUT switch to generate a truth table.');
  if (!outputs.length) throw new Error('Add an LED output to generate a truth table.');
  if (inputs.length > 6) throw new Error('Truth tables are limited to 6 input switches (64 combinations).');
  const rows: TruthTable['rows'] = [];
  for (let mask = 0; mask < 1 << inputs.length; mask++) {
    const bits: LogicBit[] = inputs.map((_, i) =>
      ((mask >> (inputs.length - i - 1)) & 1) as LogicBit);
    const byId = new Map(inputs.map((c, i) => [c.id, bits[i]]));
    const modified: DigitalDocument = {
      ...doc, components: doc.components.map(c =>
        c.kind === 'input' ? { ...c, bit: byId.get(c.id) } : c),
    };
    const result = simulateLogic(modified);
    rows.push({ inputs: bits, outputs: outputs.map(c => result.ledValues[c.id]) });
  }
  return { inputs, outputs, rows };
}
