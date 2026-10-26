import {
  DigitalBlock, DigitalComponent, DigitalDocument, GateKind, LogicValue,
  isDigitalDocument, pinsOf,
} from './types';
import { buildSignalNetwork } from './network';

/**
 * Electrical hierarchy compiler. Each block instance has an independent
 * internal netlist. Unioning the module's external pins with its internal
 * interface-switch and interface-LED nets wires it into its parent without
 * simulating boundary switches/LEDs as extra active drivers.
 *
 * Identical saved definitions may be instantiated repeatedly: each
 * instance receives a unique namespace. Nested blocks are supported;
 * recursive definition graphs and excessive expansion are rejected.
 */
class UnionFind {
  parent = new Map<string, string>();
  add(key: string) { if (!this.parent.has(key)) this.parent.set(key, key); }
  find(key: string): string {
    const p = this.parent.get(key);
    if (p === undefined) throw new Error('Unknown compiled signal net.');
    if (p === key) return p;
    const canonical = this.find(p);
    this.parent.set(key, canonical);
    return canonical;
  }
  union(a: string, b: string) {
    const rootA = this.find(a), rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }
}
export interface Primitive {
  id: string;
  component: DigitalComponent;
  a?: string;
  b?: string;
  input?: string;
  output?: string;
  label: string;
}
export interface CompiledSignals {
  roots: string[];
  terminals: Record<string, string>;
  wires: Record<string, string>;
  primitives: Primitive[];
}

export function compileSignals(doc: DigitalDocument): CompiledSignals {
  if (!isDigitalDocument(doc)) throw new Error('Invalid Signal Lab schematic.');
  const catalog = new Map((doc.blocks ?? []).map(def => [def.id, def]));
  const uf = new UnionFind();
  const primitives: Primitive[] = [];
  let total = 0, totalWires = 0;
  let topTerms: Record<string, string> = {}, topWires: Record<string, string> = {};
  const walk = (
    circuit: DigitalDocument, namespace: string, ancestors: string[],
    boundary?: DigitalBlock,
  ): Record<string, string> => {
    if (ancestors.length > 8) throw new Error('Block nesting exceeds eight levels.');
    total += circuit.components.length;
    totalWires += circuit.wires.length;
    if (total > 1600 || totalWires > 4000) {
      throw new Error('Expanded block circuit exceeds 1600 components or 4000 wires.');
    }
    const network = buildSignalNetwork(circuit);
    const key = (root: string) => namespace + '@' + root;
    for (const root of network.roots) uf.add(key(root));
    if (!boundary) {
      topTerms = Object.fromEntries(Object.entries(network.terminals).map(([pin, root]) => [pin, key(root)]));
      topWires = Object.fromEntries(Object.entries(network.wires).map(([wire, root]) => [wire, key(root)]));
    }
    const noSim = new Set(
      boundary ? [...boundary.inputs.map(p => p.componentId), ...boundary.outputs.map(p => p.componentId)] : [],
    );
    const at = (c: DigitalComponent, pin: string) => {
      const root = network.terminals[c.id + ':' + pin];
      if (!root) throw new Error('Missing internal block pin: ' + c.id + ':' + pin);
      return key(root);
    };
    for (const c of circuit.components) {
      if (c.kind === 'block') {
        const definition = catalog.get(c.blockId ?? '');
        if (!definition) throw new Error('Missing saved block: ' + (c.blockId ?? 'unknown'));
        if (ancestors.includes(definition.id)) {
          throw new Error('Recursive block definitions are not supported: ' + definition.name);
        }
        const childPrefix = namespace + '/' + c.id;
        const childNets = walk(definition.circuit, childPrefix, [...ancestors, definition.id], definition);
        for (const input of definition.inputs) {
          uf.union(at(c, input.pin), childNets[input.componentId + ':out']);
        }
        for (const output of definition.outputs) {
          uf.union(at(c, output.pin), childNets[output.componentId + ':in']);
        }
        continue;
      }
      if (noSim.has(c.id)) continue;
      primitives.push({
        id: namespace + '/' + c.id,
        component: c,
        a: pinsOf(c).includes('a') ? at(c, 'a') : undefined,
        b: pinsOf(c).includes('b') ? at(c, 'b') : undefined,
        input: c.kind === 'led' ? at(c, 'in') : undefined,
        output: c.kind !== 'led' ? at(c, 'out') : undefined,
        label: namespace === 'top' ? c.name ?? c.kind.toUpperCase() : namespace + '/' + (c.name ?? c.kind),
      });
    }
    return Object.fromEntries(
      Object.entries(network.terminals).map(([pin, root]) => [pin, key(root)]),
    );
  };
  walk(doc, 'top', []);
  const canonical = (net: string | undefined) => net ? uf.find(net) : undefined;
  return {
    roots: [...new Set([...uf.parent.keys()].map(root => uf.find(root)))],
    terminals: Object.fromEntries(Object.entries(topTerms).map(([pin, root]) => [pin, uf.find(root)])),
    wires: Object.fromEntries(Object.entries(topWires).map(([id, root]) => [id, uf.find(root)])),
    primitives: primitives.map(c => ({
      ...c, a: canonical(c.a), b: canonical(c.b),
      input: canonical(c.input), output: canonical(c.output),
    })),
  };
}
