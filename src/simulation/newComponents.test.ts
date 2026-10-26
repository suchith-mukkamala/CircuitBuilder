import { describe, expect, it } from 'vitest';
import { solveDC } from './dc';
import { starterCircuit, switchCircuit, potentiometerCircuit, currentSourceCircuit } from '../circuit/sample';
import { isCircuitDocument, pinPosition, pinsFor } from '../circuit/types';

describe('v0.2 source and control components', () => {
  it('open SPST interrupts current through the load', () => {
    const doc = switchCircuit();
    const solution = solveDC(doc);
    expect(solution.readings.r1.current).toBeCloseTo(0, 10);
    expect(solution.readings.s1.current).toBeCloseTo(0, 10);
    expect(solution.readings.s1.voltage).toBeCloseTo(10, 10);
  });

  it('closed SPST acts as an ideal zero volt branch and carries load current', () => {
    const doc = switchCircuit();
    doc.components.find(c => c.id === 's1')!.closed = true;
    const solution = solveDC(doc);
    expect(solution.readings.r1.current).toBeCloseTo(0.01, 10);
    expect(solution.readings.s1.voltage).toBeCloseTo(0, 10);
    expect(solution.readings.s1.current).toBeCloseTo(0.01, 10);
    expect(solution.readings.v1.current).toBeCloseTo(-0.01, 10);
  });

  it('supports independent current sources without a voltage source', () => {
    const result = solveDC(currentSourceCircuit());
    expect(result.readings.i1.current).toBeCloseTo(0.005, 10);
    expect(result.readings.r1.current).toBeCloseTo(0.005, 10);
    expect(result.readings.r1.voltage).toBeCloseTo(5, 10);
    expect(result.readings.i1.power).toBeCloseTo(-0.025, 10);
  });

  it('supports three-pin potentiometers with loaded wiper', () => {
    const doc = potentiometerCircuit();
    const result = solveDC(doc);
    // Rlower=500Ω in parallel with 10kΩ -> 476.190Ω.
    // Wiper V = 10*476.190/(500+476.190) = 4.87805 V.
    const wRoot = result.terminalNodes['p1:w'];
    expect(result.nodeVoltages[wRoot]).toBeCloseTo(4.878048780487805, 7);
    expect(result.readings.p1.power).toBeGreaterThan(0);
    expect(result.readings.r1.current).toBeCloseTo(4.878048780487805 / 10000, 9);
  });

  it('respects wiper adjustments', () => {
    const doc = potentiometerCircuit();
    doc.components.find(c => c.id === 'p1')!.wiper = 0.2;
    const first = solveDC(doc).nodeVoltages[solveDC(doc).terminalNodes['p1:w']];
    doc.components.find(c => c.id === 'p1')!.wiper = 0.8;
    const later = solveDC(doc).nodeVoltages[solveDC(doc).terminalNodes['p1:w']];
    expect(first).toBeGreaterThan(later);
  });

  it('preserves original v0.1 sample and saved schema compatibility', () => {
    const sample = starterCircuit();
    expect(isCircuitDocument(sample)).toBe(true);
    expect(solveDC(sample).readings.r1.voltage).toBeCloseTo(5, 9);
  });

  it('validates new component kinds and terminal assignments on import', () => {
    const doc = potentiometerCircuit();
    expect(isCircuitDocument(doc)).toBe(true);
    expect(pinsFor(doc.components[1])).toEqual(['a', 'b', 'w']);
    const terminal = pinPosition(doc.components[1], 'w');
    expect(terminal.y).toBe(doc.components[1].y + 48);
    doc.wires[0].from.pin = 'w'; // voltage sources have no wiper
    expect(isCircuitDocument(doc)).toBe(false);
  });

  it('rejects a floating disconnected current source', () => {
    const doc = currentSourceCircuit();
    doc.wires.pop();
    expect(() => solveDC(doc)).toThrow(/Connect both terminals/);
  });
});
