import {
  CircuitDocument, CircuitComponent, DCResult, TransientResult, TransientFrame, terminalKey,
} from '../circuit/types';
import { circuitNodes } from '../circuit/connectivity';
import { solveLinear } from './dc';

type History = {
  capacitorVoltage: Record<string, number>;
  inductorCurrent: Record<string, number>;
};

function validateValues(parts: CircuitComponent[]): void {
  for (const c of parts) {
    if (!Number.isFinite(c.value)) throw new Error('Invalid value at ' + c.id + '.');
    if ((c.kind === 'resistor' || c.kind === 'potentiometer') &&
      (c.value < .001 || c.value > 1e9)) throw new Error('Resistance must be from 0.001 Ω to 1 GΩ.');
    if (c.kind === 'capacitor' && (c.value < 1e-12 || c.value > 1e3))
      throw new Error('Capacitance must be from 1 pF to 1000 F.');
    if (c.kind === 'inductor' && (c.value < 1e-9 || c.value > 1e3))
      throw new Error('Inductance must be from 1 nH to 1000 H.');
    if ((c.kind === 'voltage_source' || c.kind === 'current_source') && Math.abs(c.value) > 1e9)
      throw new Error('Source magnitude cannot exceed 1e9 SI units.');
  }
}

/**
 * Backward-Euler companion-model MNA for a constant independent DC step,
 * initially uncharged capacitors and initially zero-current inductors.
 *
 * First frame (t = 0):
 *   capacitor -> ideal 0 V source; inductor -> branch fixed at 0 A.
 * Subsequent frames:
 *   capacitor -> conductance C/dt + history current source;
 *   inductor  -> current branch with V - (L/dt)I = -(L/dt)I_previous.
 *
 * Voltage and current sources are independent and held constant in time.
 */
export function runTransient(doc: CircuitDocument, options: {
  duration?: number;
  steps?: number;
} = {}): TransientResult {
  const duration = options.duration ?? 1;
  const steps = options.steps ?? 180;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60)
    throw new Error('Simulation duration must be between 0 and 60 seconds.');
  if (!Number.isInteger(steps) || steps < 2 || steps > 500)
    throw new Error('Simulation must have 2–500 time steps.');
  const parts = doc.components.filter(c => c.kind !== 'ground');
  if (!parts.some(c => c.kind === 'voltage_source' || c.kind === 'current_source'))
    throw new Error('Add a voltage or current source before running transient analysis.');
  if (!parts.some(c => c.kind === 'capacitor' || c.kind === 'inductor'))
    throw new Error('Add a capacitor or inductor to see time-dependent behavior.');
  const { terminalNodes, ground } = circuitNodes(doc);
  validateValues(parts);
  const nodeRoots = [...new Set(Object.values(terminalNodes))].filter(root => root !== ground).sort();
  const indexMap = new Map(nodeRoots.map((root, i) => [root, i]));
  const n = nodeRoots.length;
  const dt = duration / steps;

  const node = (c: CircuitComponent, pin: 'a' | 'b' | 'w') => {
    const root = terminalNodes[terminalKey({ componentId: c.id, pin })];
    if (!root) throw new Error('Terminal not found: ' + c.id + '/' + pin);
    return root === ground ? -1 : indexMap.get(root)!;
  };
  const roots = (c: CircuitComponent, pin: 'a' | 'b' | 'w', voltages: Record<string, number>) =>
    voltages[terminalNodes[terminalKey({ componentId: c.id, pin })]];

  const frameAt = (time: number, history: History, initial: boolean): {
    frame: TransientFrame;
    next: History;
  } => {
    const branches = parts.filter(c =>
      c.kind === 'voltage_source' ||
      c.kind === 'inductor' ||
      (c.kind === 'switch' && c.closed) ||
      (initial && c.kind === 'capacitor'));
    const size = n + branches.length;
    if (size > 400) throw new Error('Circuit too large for v0.3 transient analysis.');
    const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    const rhs = new Array<number>(size).fill(0);
    const stamp = (r: number, col: number, v: number) => {
      if (r >= 0 && col >= 0) A[r][col] += v;
    };
    const conductance = (an: number, bn: number, g: number) => {
      stamp(an, an, g); stamp(bn, bn, g);
      stamp(an, bn, -g); stamp(bn, an, -g);
    };

    for (const c of parts) {
      const an = node(c, 'a'), bn = node(c, 'b');
      if (c.kind === 'resistor') conductance(an, bn, 1 / c.value);
      if (c.kind === 'potentiometer') {
        const w = node(c, 'w'), fraction = c.wiper ?? .5;
        conductance(an, w, 1 / (c.value * fraction));
        conductance(w, bn, 1 / (c.value * (1 - fraction)));
      }
      if (c.kind === 'current_source') {
        if (an >= 0) rhs[an] -= c.value;
        if (bn >= 0) rhs[bn] += c.value;
      }
      if (c.kind === 'capacitor' && !initial) {
        const g = c.value / dt;
        conductance(an, bn, g);
        // I_C = C/dt * (V_now - V_previous). Previous contribution
        // moves to RHS as an independent positive current injection at A.
        const prev = history.capacitorVoltage[c.id] ?? 0;
        if (an >= 0) rhs[an] += g * prev;
        if (bn >= 0) rhs[bn] -= g * prev;
      }
    }

    branches.forEach((c, i) => {
      const an = node(c, 'a'), bn = node(c, 'b'), row = n + i;
      // Each constrained branch current participates in KCL.
      stamp(an, row, 1); stamp(bn, row, -1);
      if (c.kind === 'inductor' && initial) {
        // Initial inductor current is 0 A, voltage is unconstrained.
        stamp(row, row, 1); rhs[row] = 0;
      } else {
        stamp(row, an, 1); stamp(row, bn, -1);
        if (c.kind === 'voltage_source') rhs[row] = c.value;
        if (c.kind === 'inductor') {
          const resistance = c.value / dt;
          stamp(row, row, -resistance);
          rhs[row] = -resistance * (history.inductorCurrent[c.id] ?? 0);
        }
        // Switch closed and t=0 capacitor: prescribed 0 V.
      }
    });

    const solution = solveLinear(A, rhs);
    const nodeVoltages: DCResult['nodeVoltages'] = { [ground]: 0 };
    nodeRoots.forEach((root, i) => { nodeVoltages[root] = solution[i]; });
    const readings: DCResult['readings'] = {};
    const next: History = { capacitorVoltage: { ...history.capacitorVoltage },
      inductorCurrent: { ...history.inductorCurrent } };

    for (const c of parts) {
      const va = roots(c, 'a', nodeVoltages), vb = roots(c, 'b', nodeVoltages);
      const voltage = va - vb;
      let current = 0, power = 0;
      if (c.kind === 'resistor') {
        current = voltage / c.value;
        power = voltage * current;
      } else if (c.kind === 'potentiometer') {
        const vw = roots(c, 'w', nodeVoltages), fraction = c.wiper ?? .5;
        const ia = (va - vw) / (c.value * fraction);
        const ib = (vw - vb) / (c.value * (1 - fraction));
        current = ia;
        power = (va - vw) * ia + (vw - vb) * ib;
      } else if (c.kind === 'current_source') {
        current = c.value; power = voltage * current;
      } else if (c.kind === 'capacitor') {
        if (initial) {
          current = solution[n + branches.findIndex(b => b.id === c.id)];
        } else {
          current = c.value / dt * (voltage - (history.capacitorVoltage[c.id] ?? 0));
        }
        power = voltage * current;
        next.capacitorVoltage[c.id] = voltage;
      } else if (c.kind === 'voltage_source' || (c.kind === 'switch' && c.closed) ||
          c.kind === 'inductor') {
        current = solution[n + branches.findIndex(b => b.id === c.id)];
        power = voltage * current;
        if (c.kind === 'inductor') next.inductorCurrent[c.id] = current;
      }
      readings[c.id] = { voltage, current, power };
    }
    return {
      frame: { time, nodeVoltages, terminalNodes, readings, nodeCount: nodeRoots.length + 1 },
      next,
    };
  };

  const frames: TransientFrame[] = [];
  let history: History = { capacitorVoltage: {}, inductorCurrent: {} };
  for (let i = 0; i <= steps; i++) {
    const { frame, next } = frameAt(i * dt, history, i === 0);
    frames.push(frame);
    history = next;
  }
  return { duration, steps, frames };
}
