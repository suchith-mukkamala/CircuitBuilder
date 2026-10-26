import { CircuitDocument, DCResult, CircuitComponent, terminalKey } from '../circuit/types';
import { circuitNodes } from '../circuit/connectivity';
import { explainFloatingNodes, explainIdealConstraintShort } from './diagnostics';

/**
 * Modified Nodal Analysis for linear DC circuits.
 *
 * [ G  B ] [node voltages] = [independent-current injections]
 * [ Bᵀ 0 ] [ideal branch currents] [source voltages / switch constraints]
 *
 * Each closed SPST is stamped as an ideal 0 V voltage source. Open SPSTs
 * do not stamp a branch. The potentiometer is two resistors (a-w, w-b).
 * Current source polarity is from terminal a toward b.
 *
 * This module has no dependency on React, canvas, or storage.
 */
export function solveDC(doc: CircuitDocument): DCResult {
  const { terminalNodes, ground } = circuitNodes(doc);
  const parts = doc.components.filter(c => c.kind !== 'ground');
  if (parts.length === 0) throw new Error('Add a component and a power source to simulate.');
  if (!parts.some(c => c.kind === 'voltage_source' || c.kind === 'current_source')) {
    throw new Error('Add a voltage or current source to simulate.');
  }
  for (const c of parts) {
    if (!Number.isFinite(c.value)) throw new Error('Invalid component value at ' + c.id + '.');
    if ((c.kind === 'resistor' || c.kind === 'potentiometer') &&
        (c.value < 0.001 || c.value > 1e9)) {
      throw new Error('Resistance must be between 0.001 Ω and 1 GΩ.');
    }
    if ((c.kind === 'voltage_source' || c.kind === 'current_source') &&
        Math.abs(c.value) > 1e9) {
      throw new Error('Source magnitude is too large (maximum 1e9 SI units).');
    }
    if (c.kind === 'capacitor' && (c.value < 1e-12 || c.value > 1e3)) {
      throw new Error('Capacitance must be between 1 pF and 1000 F.');
    }
    if (c.kind === 'inductor' && (c.value < 1e-9 || c.value > 1e3)) {
      throw new Error('Inductance must be between 1 nH and 1000 H.');
    }
    if (c.kind === 'potentiometer' && (c.wiper ?? 0.5) < 0.001) {
      throw new Error('Potentiometer wiper must be between 0.1% and 99.9%.');
    }
    if (c.kind === 'potentiometer' && (c.wiper ?? 0.5) > 0.999) {
      throw new Error('Potentiometer wiper must be between 0.1% and 99.9%.');
    }
  }

  // Diagnose disconnected DC islands and ideal shorts BEFORE matrix solving.
  // Otherwise both look like an opaque singular-matrix error to the user.
  const short = explainIdealConstraintShort(doc, terminalNodes);
  if (short) throw new Error(short);
  const floating = explainFloatingNodes(doc, terminalNodes, ground);
  if (floating) throw new Error(floating);

  const roots = [...new Set(Object.values(terminalNodes))].filter(root => root !== ground).sort();
  const indexes = new Map(roots.map((root, i) => [root, i]));
  const n = roots.length;
  const constrainedParts = parts.filter(c => c.kind === 'voltage_source' ||
    c.kind === 'inductor' || (c.kind === 'switch' && c.closed));
  const size = n + constrainedParts.length;
  if (size > 400) throw new Error('Circuit exceeds the v0.2 solver limit (400 unknowns).');
  if (size === 0) throw new Error('No electrical nodes to analyze.');

  const a = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rhs = new Array<number>(size).fill(0);
  const index = (id: string, pin: 'a' | 'b' | 'w') => {
    const root = terminalNodes[terminalKey({ componentId: id, pin })];
    if (root === undefined) throw new Error('Missing terminal at ' + id + ':' + pin);
    return root === ground ? -1 : indexes.get(root)!;
  };
  const stamp = (r: number, c: number, amount: number) => {
    if (r >= 0 && c >= 0) a[r][c] += amount;
  };
  const resistor = (nodeA: number, nodeB: number, ohms: number) => {
    const g = 1 / ohms;
    stamp(nodeA, nodeA, g);
    stamp(nodeB, nodeB, g);
    stamp(nodeA, nodeB, -g);
    stamp(nodeB, nodeA, -g);
  };

  for (const c of parts) {
    const an = index(c.id, 'a'), bn = index(c.id, 'b');
    if (c.kind === 'resistor') resistor(an, bn, c.value);
    if (c.kind === 'potentiometer') {
      const wn = index(c.id, 'w');
      const fraction = c.wiper ?? 0.5;
      resistor(an, wn, c.value * fraction);
      resistor(wn, bn, c.value * (1 - fraction));
    }
    if (c.kind === 'current_source') {
      // +I flows a -> b, so node a loses current and b gains current.
      if (an >= 0) rhs[an] -= c.value;
      if (bn >= 0) rhs[bn] += c.value;
    }
  }

  constrainedParts.forEach((c, i) => {
    const an = index(c.id, 'a'), bn = index(c.id, 'b'), row = n + i;
    stamp(an, row, 1); stamp(bn, row, -1);
    stamp(row, an, 1); stamp(row, bn, -1);
    rhs[row] = c.kind === 'voltage_source' ? c.value : 0;
  });

  let solution: number[];
  try {
    solution = solveLinear(a, rhs);
  } catch (error) {
    if (!(error instanceof Error) || !/cannot be solved/i.test(error.message)) throw error;
    throw new Error('Circuit cannot be solved: the network has dependent or conflicting ideal constraints. Check for ' +
      'parallel ideal voltage sources, closed-switch bypasses, or loops containing only ideal ' +
      'sources and inductors. Try adding a physical resistor in series with the ideal loop.');
  }
  const nodeVoltages: Record<string, number> = { [ground]: 0 };
  roots.forEach((root, i) => { nodeVoltages[root] = solution[i]; });
  const at = (c: CircuitComponent, pin: 'a' | 'b' | 'w') =>
    nodeVoltages[terminalNodes[terminalKey({ componentId: c.id, pin })]];
  const readings: DCResult['readings'] = {};
  for (const c of parts) {
    const voltage = at(c, 'a') - at(c, 'b');
    let current = 0;
    let power = 0;
    if (c.kind === 'resistor') {
      current = voltage / c.value;
      power = voltage * current;
    } else if (c.kind === 'potentiometer') {
      const fraction = c.wiper ?? 0.5;
      const ia = (at(c, 'a') - at(c, 'w')) / (c.value * fraction);
      const ib = (at(c, 'w') - at(c, 'b')) / (c.value * (1 - fraction));
      current = ia; // a -> w branch; wiper current can cause ia != ib.
      power = (at(c, 'a') - at(c, 'w')) * ia +
        (at(c, 'w') - at(c, 'b')) * ib;
    } else if (c.kind === 'current_source') {
      current = c.value;
      power = voltage * current;
    } else if (c.kind === 'voltage_source' || c.kind === 'inductor' || (c.kind === 'switch' && c.closed)) {
      const branchIndex = constrainedParts.findIndex(p => p.id === c.id);
      current = solution[n + branchIndex];
      power = voltage * current;
    }
    // Steady-state DC: capacitors are open, inductors are ideal shorts.
    // Open switches have zero current and signed open-circuit voltage.
    readings[c.id] = { voltage, current, power };
  }
  return { nodeVoltages, terminalNodes, readings, nodeCount: roots.length + 1 };
}

/** Dense Gaussian elimination with partial pivoting; adequate for modest v0.x schematics. */
export function solveLinear(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (!Number.isFinite(a[pivot][col]) || Math.abs(a[pivot][col]) < 1e-13) {
      throw new Error('Circuit cannot be solved. Check for floating nodes, shorts, or conflicting ideal sources.');
    }
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
  if (solved.some(v => !Number.isFinite(v))) {
    throw new Error('Numerical instability while solving circuit.');
  }
  return solved;
}
