import { describe, expect, it } from 'vitest';
import { starterCircuit } from './sample';
import { isCircuitDocument, pinPosition } from './types';
import { onWire, wirePath } from './geometry';
import { circuitNodes } from './connectivity';
import { solveDC } from '../simulation/dc';

describe('free-ended traces and junction topology', () => {
  it('accepts a dangling wire tip and joins a component moved onto it', () => {
    const doc = starterCircuit();
    const r2 = doc.components.find(c => c.id === 'r2')!;
    const formerPin = pinPosition(r2, 'a');
    const w2 = doc.wires.find(w => w.id === 'w2')!;
    w2.to = formerPin;
    expect(isCircuitDocument(doc)).toBe(true);
    const solved = solveDC(doc);
    expect(solved.readings.r1.current).toBeCloseTo(.005);
    expect(solved.readings.r2.current).toBeCloseTo(.005);
    // Moving the component physically disconnects its A terminal, even
    // though the free wire endpoint remains at its previous location.
    r2.x += 96;
    expect(() => solveDC(doc)).toThrow(/Connect both terminals/i);
  });

  it('supports a free wire junction placed on an existing trace segment', () => {
    const doc = starterCircuit();
    doc.components.push({
      id: 'r3', kind: 'resistor', x: 720, y: 168,
      rotation: 0, value: 1000,
    });
    const junction = { x: 456, y: 168 };
    expect(onWire(junction, doc.wires.find(w => w.id === 'w2')!, doc)).toBe(true);
    doc.wires.push(
      { id: 'branch1', from: { componentId: 'r3', pin: 'a' }, to: junction },
      { id: 'branch2', from: { componentId: 'r3', pin: 'b' },
        to: { componentId: 'g1', pin: 'g' } },
    );
    const result = solveDC(doc);
    const center = result.nodeVoltages[result.terminalNodes['r1:b']];
    // 1k upper with two parallel 1k lower loads.
    expect(center).toBeCloseTo(10 / 3, 5);
    expect(result.readings.r3.current).toBeCloseTo(1 / 300, 6);
  });

  it('supports old terminal-to-terminal JSON without new endpoint fields', () => {
    const old = starterCircuit();
    expect(isCircuitDocument(JSON.parse(JSON.stringify(old)))).toBe(true);
    expect(circuitNodes(old).terminalNodes['r1:b'])
      .toBe(circuitNodes(old).terminalNodes['r2:a']);
    expect(wirePath(old.wires[0], old).length).toBeGreaterThanOrEqual(2);
    expect(solveDC(old).readings.r1.voltage).toBeCloseTo(5);
  });

  it('rejects invalid free wire endpoint coordinates', () => {
    const doc = starterCircuit();
    doc.wires[0].to = { x: NaN, y: 24 };
    expect(isCircuitDocument(doc)).toBe(false);
  });
});
