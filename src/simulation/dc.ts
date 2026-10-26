import { CircuitDocument, DCResult, terminalKey } from '../circuit/types';
import { circuitNodes } from '../circuit/connectivity';

/**
 * Modified Nodal Analysis:
 * [G B][v] = [0]
 * [C D][i]   [E]
 *
 * Resistor currents are from pin a to pin b; source current is from
 * its positive (a) terminal to its negative (b) terminal.
 */
export function solveDC(doc: CircuitDocument): DCResult {
  const { terminalNodes, ground } = circuitNodes(doc);
  const components = doc.components.filter(c => c.kind !== 'ground');
  if (components.length === 0) throw new Error('Add a resistor and a voltage source to simulate.');
  const sourceComponents = components.filter(c => c.kind === 'voltage_source');
  if (sourceComponents.length === 0) throw new Error('Add a voltage source to simulate.');
  for (const c of components) {
    if (!Number.isFinite(c.value)) throw new Error('Invalid component value at ' + c.id + '.');
    if (c.kind === 'resistor' && (c.value < 0.001 || c.value > 1e9))
      throw new Error('Resistance must be between 0.001 Ω and 1 GΩ.');
    if (c.kind === 'voltage_source' && Math.abs(c.value) > 1e9)
      throw new Error('Voltage must be between -1 GV and 1 GV.');
  }

  const nodeRoots = [...new Set(Object.values(terminalNodes))].filter(root => root !== ground).sort();
  const nodeIndex = new Map(nodeRoots.map((key, i) => [key, i]));
  const n = nodeRoots.length;
  const size = n + sourceComponents.length;
  if (size > 400) throw new Error('Circuit too large for the v0.1 DC solver.');
  const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rhs = new Array<number>(size).fill(0);
  const node = (id: string, pin: 'a' | 'b') => {
    const root = terminalNodes[terminalKey({ componentId: id, pin })];
    return root === ground ? -1 : (nodeIndex.get(root) ?? -1);
  };
  const stamp = (r: number, c: number, amount: number) => {
    if (r >= 0 && c >= 0) A[r][c] += amount;
  };

  for (const c of components.filter(c => c.kind === 'resistor')) {
    const a = node(c.id, 'a'), b = node(c.id, 'b'), g = 1 / c.value;
    stamp(a, a, g); stamp(b, b, g);
    stamp(a, b, -g); stamp(b, a, -g);
  }
  sourceComponents.forEach((c, i) => {
    const a = node(c.id, 'a'), b = node(c.id, 'b'), row = n + i;
    stamp(a, row, 1); stamp(b, row, -1);
    stamp(row, a, 1); stamp(row, b, -1);
    rhs[row] = c.value;
  });

  const result = solveLinear(A, rhs);
  const nodeVoltages: Record<string, number> = { [ground]: 0 };
  nodeRoots.forEach((root, i) => { nodeVoltages[root] = result[i]; });
  const readings: DCResult['readings'] = {};
  for (const c of components) {
    const va = nodeVoltages[terminalNodes[terminalKey({ componentId: c.id, pin: 'a' })]];
    const vb = nodeVoltages[terminalNodes[terminalKey({ componentId: c.id, pin: 'b' })]];
    const voltage = va - vb;
    const current = c.kind === 'resistor'
      ? voltage / c.value
      : result[n + sourceComponents.findIndex(source => source.id === c.id)];
    readings[c.id] = { voltage, current, power: voltage * current };
  }
  return { nodeVoltages, terminalNodes, readings, nodeCount: nodeRoots.length + 1 };
}

export function solveLinear(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++)
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (!Number.isFinite(a[pivot][col]) || Math.abs(a[pivot][col]) < 1e-13)
      throw new Error('Circuit cannot be solved. Check for floating nodes, shorts, or conflicting sources.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const diagonal = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= diagonal;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  const solved = a.map(row => row[n]);
  if (solved.some(v => !Number.isFinite(v)))
    throw new Error('Numerical instability while solving circuit.');
  return solved;
}
