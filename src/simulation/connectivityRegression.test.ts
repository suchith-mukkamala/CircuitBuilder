import { describe, expect, it } from 'vitest';
import { starterCircuit, rcCircuit, rlCircuit } from '../circuit/sample';
import { circuitNodes } from '../circuit/connectivity';
import { solveDC } from './dc';
import { runTransient } from './transient';
import type { CircuitDocument } from '../circuit/types';

/**
 * Regression cases for physically connected schematics made in the editor.
 * Before the fix, a pin could sit on a luminous wire and still be omitted
 * from the connectivity graph, producing a generic singular MNA matrix.
 */
describe('visual-contact connectivity and actionable errors', () => {
  it('simulates a resistor attached to the middle of an existing wire', () => {
    const doc = starterCircuit();
    doc.components.push({
      id: 'r3', kind: 'resistor', x: 504, y: 168,
      rotation: 0, value: 1000,
    });
    // R3.a at x=456,y=168 sits directly on w2's horizontal segment.
    // No explicit wire references R3.a, exactly like a dragged-on component.
    doc.wires.push({
      id: 'w5',
      from: { componentId: 'r3', pin: 'b' },
      to: { componentId: 'g1', pin: 'g' },
      waypoints: [{ x: 600, y: 168 }, { x: 600, y: 540 }, { x: 336, y: 540 }],
    });
    const nets = circuitNodes(doc).terminalNodes;
    expect(nets['r3:a']).toBe(nets['r1:b']);
    const solved = solveDC(doc);
    expect(solved.nodeVoltages[solved.terminalNodes['r3:a']]).toBeCloseTo(10 / 3, 6);
    expect(solved.readings.r3.current).toBeCloseTo(1 / 300, 7);
  });

  it('does not join crossing traces without a junction endpoint', () => {
    const doc = starterCircuit();
    const baseline = solveDC(doc);
    doc.wires.push({
      id: 'floating-crossing',
      from: { x: 456, y: 96 },
      to: { x: 456, y: 240 },
    });
    const result = solveDC(doc);
    expect(result.readings.r1.current).toBeCloseTo(baseline.readings.r1.current);
    expect(result.readings.r2.current).toBeCloseTo(baseline.readings.r2.current);
  });

  it('produces a named floating-node diagnosis when a capacitor isolates a DC island', () => {
    const doc: CircuitDocument = {
      version: 1,
      name: 'capacitive floating island',
      components: [
        { id: 'v', kind: 'voltage_source', x: 0, y: 0, rotation: 0, value: 10 },
        { id: 'c1', kind: 'capacitor', x: 240, y: 0, rotation: 0, value: .0001 },
        { id: 'r', kind: 'resistor', x: 480, y: 0, rotation: 0, value: 1000 },
        { id: 'c2', kind: 'capacitor', x: 720, y: 0, rotation: 0, value: .0001 },
        { id: 'g', kind: 'ground', x: 0, y: 240, rotation: 0, value: 0 },
      ],
      wires: [
        { id: '1', from: { componentId: 'v', pin: 'a' }, to: { componentId: 'c1', pin: 'a' } },
        { id: '2', from: { componentId: 'c1', pin: 'b' }, to: { componentId: 'r', pin: 'a' } },
        { id: '3', from: { componentId: 'r', pin: 'b' }, to: { componentId: 'c2', pin: 'a' } },
        { id: '4', from: { componentId: 'c2', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
        { id: '5', from: { componentId: 'v', pin: 'b' }, to: { componentId: 'g', pin: 'g' } },
      ],
    };
    expect(() => solveDC(doc)).toThrow(/Floating DC node near .*R1.*RUN TRANSIENT/);
    expect(runTransient(doc, { duration: .2, steps: 60 }).frames).toHaveLength(61);
  });

  it('distinguishes a voltage source short from a disconnected ground', () => {
    const doc = starterCircuit();
    // Direct connection between V+ and V- violates the 10 V constraint.
    doc.wires.push({
      id: 'short', from: { componentId: 'v1', pin: 'a' },
      to: { componentId: 'v1', pin: 'b' },
    });
    expect(() => solveDC(doc)).toThrow(/V1 is shorted/i);
  });

  it('keeps the RC and RL example circuits solvable', () => {
    expect(solveDC(rcCircuit()).readings.r1.voltage).toBeCloseTo(0, 8);
    expect(solveDC(rlCircuit()).readings.r1.current).toBeCloseTo(.01, 8);
    expect(runTransient(rcCircuit(), { duration: .2, steps: 80 })
      .frames[80].readings.r1.current).toBeGreaterThan(0);
  });
});
