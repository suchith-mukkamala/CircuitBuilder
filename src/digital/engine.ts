import {
  DigitalDocument, DigitalComponent, GateKind, LogicBit, LogicValue, LogicResult,
  digitalLabel, isDigitalDocument, pinsOf,
} from './types';
import { buildSignalNetwork } from './network';

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

/** Pure combinational 4-state circuit engine. No analog solver dependency. */
export function simulateLogic(doc: DigitalDocument): LogicResult {
  if (!isDigitalDocument(doc)) throw new Error('Invalid Signal Lab circuit document.');
  if (doc.components.length > 500 || doc.wires.length > 1200) {
    throw new Error('Signal Lab v0.1 supports up to 500 components and 1200 wires.');
  }
  const network = buildSignalNetwork(doc);
  const gates = doc.components.filter(c => c.kind !== 'input' && c.kind !== 'led');
  const outputs = doc.components.filter(c => c.kind === 'input' || c.kind !== 'led');
  let computed = new Map<string, LogicValue>(gates.map(c => [c.id, 'X']));
  let voltages = new Map<string, LogicValue>();
  const pinNet = (c: DigitalComponent, pin: string) => network.terminals[c.id + ':' + pin];
  const conflicts = new Set<string>();
  const updateNet = (values: Map<string, LogicValue>): Map<string, LogicValue> => {
    const drivers = new Map<string, LogicValue[]>();
    for (const root of network.roots) drivers.set(root, []);
    for (const c of outputs) {
      const root = pinNet(c, 'out');
      if (!root) continue;
      drivers.get(root)?.push(c.kind === 'input' ? (c.bit ?? 0) : (computed.get(c.id) ?? 'X'));
    }
    const next = new Map<string, LogicValue>();
    for (const root of network.roots) {
      const inputs = drivers.get(root) ?? [];
      if (inputs.length > 1) {
        next.set(root, 'X');
        conflicts.add(root);
      } else next.set(root, inputs.length ? inputs[0] : 'Z');
    }
    return next;
  };
  let stabilized = false;
  // Combinational circuits settle in at most gate-count depth for acyclic nets.
  // Feedback without a stable binary result stays X rather than oscillating forever.
  for (let iteration = 0; iteration < Math.max(6, gates.length + 3); iteration++) {
    const nextNets = updateNet(voltages);
    const nextGates = new Map<string, LogicValue>();
    for (const c of gates) {
      const kind = c.kind as GateKind;
      const a = nextNets.get(pinNet(c, 'a')) ?? 'Z';
      const b = pinsOf(c).includes('b') ? nextNets.get(pinNet(c, 'b')) ?? 'Z' : 'Z';
      nextGates.set(c.id, evaluateGate(kind, a, b));
    }
    stabilized = [...nextGates].every(([id, value]) => computed.get(id) === value);
    voltages = nextNets;
    computed = nextGates;
    if (stabilized) break;
  }
  // Ensure the final net values reflect the last computed gate outputs.
  voltages = updateNet(voltages);
  if (!stabilized) {
    // Conservative interpretation for a potentially oscillating combinational loop.
    for (const c of gates) computed.set(c.id, 'X');
    voltages = updateNet(voltages);
  }

  const terminalValues: Record<string, LogicValue> = {};
  const wireValues: Record<string, LogicValue> = {};
  const netValues: Record<string, LogicValue> = {};
  for (const [root, value] of voltages) netValues[root] = value;
  for (const [key, root] of Object.entries(network.terminals)) terminalValues[key] = netValues[root];
  for (const [key, root] of Object.entries(network.wires)) wireValues[key] = netValues[root];
  const ledValues: Record<string, LogicValue> = {}, gateValues: Record<string, LogicValue> = {};
  for (const c of doc.components) {
    if (c.kind === 'led') ledValues[c.id] = terminalValues[c.id + ':in'] ?? 'Z';
    else if (c.kind !== 'input') gateValues[c.id] = computed.get(c.id) ?? 'X';
  }
  const warnings: string[] = [];
  for (const c of doc.components) {
    if (c.kind === 'input') continue;
    for (const pin of pinsOf(c).filter(pin => pin !== 'out')) {
      if (terminalValues[c.id + ':' + pin] === 'Z') {
        warnings.push(digitalLabel(c, doc.components) + '.' + pin.toUpperCase() + ' has no driver.');
      }
    }
  }
  if (conflicts.size) warnings.push(conflicts.size + ' net(s) have multiple active outputs connected together.');
  if (!stabilized) warnings.push('Combinational feedback did not settle; check for loops without storage.');
  return {
    terminalValues, wireValues, netValues,
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
