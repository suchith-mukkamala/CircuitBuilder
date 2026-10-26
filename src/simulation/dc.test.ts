import { describe, expect, it } from 'vitest';
import { solveDC, solveLinear } from './dc';
import { starterCircuit } from '../circuit/sample';
import type { CircuitDocument } from '../circuit/types';

describe('DC / Modified Nodal Analysis', () => {
  it('solves a 10 V equal-resistor divider at 5 V / 5 mA', () => {
    const doc = starterCircuit();
    const result = solveDC(doc);
    expect(result.nodeCount).toBe(3);
    expect(result.readings.r1.current).toBeCloseTo(0.005, 9);
    expect(result.readings.r2.current).toBeCloseTo(0.005, 9);
    expect(result.readings.r1.voltage).toBeCloseTo(5, 9);
    expect(result.readings.r2.voltage).toBeCloseTo(5, 9);
    expect(result.readings.v1.current).toBeCloseTo(-0.005, 9);
    const outputRoot = result.terminalNodes['r1:b'];
    expect(result.nodeVoltages[outputRoot]).toBeCloseTo(5, 9);
  });

  it('supports parallel resistor branches', () => {
    const doc = starterCircuit();
    doc.components = doc.components.filter(c => c.id !== 'r2');
    doc.wires = [
      { id: 'a', from: { componentId: 'v1', pin: 'a' }, to: { componentId: 'r1', pin: 'a' } },
      { id: 'b', from: { componentId: 'v1', pin: 'b' }, to: { componentId: 'g1', pin: 'g' } },
      { id: 'c', from: { componentId: 'r1', pin: 'b' }, to: { componentId: 'g1', pin: 'g' } },
    ];
    doc.components.push({ id: 'r3', kind: 'resistor', x: 0, y: 0, rotation: 0, value: 2000 });
    doc.wires.push(
      { id: 'd', from: { componentId: 'v1', pin: 'a' }, to: { componentId: 'r3', pin: 'a' } },
      { id: 'e', from: { componentId: 'r3', pin: 'b' }, to: { componentId: 'g1', pin: 'g' } },
    );
    const r = solveDC(doc);
    expect(r.readings.r1.current).toBeCloseTo(0.01, 9);
    expect(r.readings.r3.current).toBeCloseTo(0.005, 9);
    expect(r.readings.v1.current).toBeCloseTo(-0.015, 9);
  });

  it('rejects a circuit without ground', () => {
    const doc = starterCircuit();
    doc.components = doc.components.filter(c => c.kind !== 'ground');
    expect(() => solveDC(doc)).toThrow(/ground/i);
  });

  it('reports unconnected pins', () => {
    const doc = starterCircuit();
    doc.wires = doc.wires.filter(w => w.id !== 'w2');
    expect(() => solveDC(doc)).toThrow(/Connect both terminals/i);
  });

  it('rejects zero resistance', () => {
    const doc = starterCircuit();
    doc.components.find(c => c.id === 'r1')!.value = 0;
    expect(() => solveDC(doc)).toThrow(/Resistance/);
  });

  it('identifies conflicting parallel voltage sources', () => {
    const doc = starterCircuit();
    doc.components.push({ id: 'v2', kind: 'voltage_source', x: 50, y: 50, rotation: 0, value: 5 });
    doc.wires.push(
      { id: 'x', from: { componentId: 'v1', pin: 'a' }, to: { componentId: 'v2', pin: 'a' } },
      { id: 'y', from: { componentId: 'v1', pin: 'b' }, to: { componentId: 'v2', pin: 'b' } },
    );
    expect(() => solveDC(doc)).toThrow(/cannot be solved/i);
  });

  it('solves a general pivoted linear system', () => {
    expect(solveLinear([[0, 1], [2, 1]], [3, 7])).toEqual([2, 3]);
  });

  it('accepts a resistor-free source referenced to ground', () => {
    const doc: CircuitDocument = {
      version: 1, name: 'source', components: [
        { id: 'g', kind: 'ground', x: 0, y: 0, rotation: 0, value: 0 },
        { id: 'v', kind: 'voltage_source', x: 0, y: 0, rotation: 0, value: 9 },
      ],
      wires: [
        { id: 'w', from: { componentId: 'v', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
        { id: 'w2', from: { componentId: 'v', pin: 'a' }, to: { componentId: 'v', pin: 'a' } },
      ],
    };
    const r = solveDC(doc);
    expect(r.nodeCount).toBe(2);
    expect(r.readings.v.voltage).toBeCloseTo(9);
  });
});
